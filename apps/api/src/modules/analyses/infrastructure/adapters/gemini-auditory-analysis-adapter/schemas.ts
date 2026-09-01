import { Type as GenAiType } from '@google/genai'
import { Type } from 'typebox'
import { Value } from 'typebox/value'

import { MalformedAuditoryAnalysisError } from '@/modules/analyses/domain/errors/malformed-auditory-analysis-error/index.js'
import {
  MAX_AUDITORY_CANDIDATE_EVENTS,
  MAX_AUDITORY_LIMITATIONS,
} from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type {
  AuditoryCandidateEvent,
  AuditoryObservation,
} from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import {
  AUDIO_USABILITIES,
  FEEDBACK_CONFIDENCES,
  MOMENT_CATEGORIES,
} from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'

const MAX_LIMITATION_LENGTH = 300
const MAX_MESSAGE_LENGTH = 1_000
const MAX_SUMMARY_LENGTH = 1_500
const MAX_TRANSCRIPT_LENGTH = 20_000
const MAX_EXCERPT_LENGTH = 400
const MAX_EVIDENCE_LENGTH = 600
const TIMESTAMP_TOLERANCE_SECONDS = 0.25
const MARKUP_PATTERN = /<[A-Za-z/]|```|\[[^\]]+\]\([^)]*\)/

export const AUDITORY_RESPONSE_SCHEMA = {
  type: GenAiType.OBJECT,
  properties: {
    audioUsability: {
      type: GenAiType.STRING,
      format: 'enum',
      enum: [...AUDIO_USABILITIES],
      description:
        'usable quando a fala é audível do início ao fim; limited quando parte do áudio impede observar; unusable quando não há fala audível suficiente.',
    },
    limitations: {
      type: GenAiType.ARRAY,
      maxItems: String(MAX_AUDITORY_LIMITATIONS),
      items: {
        type: GenAiType.STRING,
        maxLength: String(MAX_LIMITATION_LENGTH),
        description: 'O que a gravação impediu de observar, descrito pelo que se ouve.',
      },
    },
    literalTranscript: {
      type: GenAiType.STRING,
      maxLength: String(MAX_TRANSCRIPT_LENGTH),
      description:
        'Tudo o que foi dito, preservando marcas de oralidade claramente audíveis como hesitações, prolongamentos, repetições e reinícios.',
    },
    mainMessage: {
      type: GenAiType.STRING,
      maxLength: String(MAX_MESSAGE_LENGTH),
      description: 'A mensagem principal percebida na fala.',
    },
    attemptedStructure: {
      type: GenAiType.STRING,
      maxLength: String(MAX_MESSAGE_LENGTH),
      description: 'A organização que a pessoa tentou dar à fala, na ordem em que apareceu.',
    },
    deliverySummary: {
      type: GenAiType.STRING,
      maxLength: String(MAX_SUMMARY_LENGTH),
      description:
        'Observação qualitativa do ritmo percebido, entonação, ênfase, volume e estabilidade da voz.',
    },
    candidateEvents: {
      type: GenAiType.ARRAY,
      maxItems: String(MAX_AUDITORY_CANDIDATE_EVENTS),
      items: {
        type: GenAiType.OBJECT,
        properties: {
          startSeconds: {
            type: GenAiType.NUMBER,
            minimum: 0,
            description: 'Início aproximado do trecho, em segundos desde o começo da gravação.',
          },
          endSeconds: {
            type: GenAiType.NUMBER,
            minimum: 0,
            description: 'Fim aproximado do trecho, em segundos, nunca antes do início.',
          },
          excerpt: {
            type: GenAiType.STRING,
            maxLength: String(MAX_EXCERPT_LENGTH),
            description: 'O trecho falado tal como soou.',
          },
          category: {
            type: GenAiType.STRING,
            format: 'enum',
            enum: [...MOMENT_CATEGORIES],
            description: 'A categoria audível do evento.',
          },
          auditoryEvidence: {
            type: GenAiType.STRING,
            maxLength: String(MAX_EVIDENCE_LENGTH),
            description: 'O que no som sustenta o evento, sem interpretar intenção.',
          },
          confidence: {
            type: GenAiType.STRING,
            format: 'enum',
            enum: [...FEEDBACK_CONFIDENCES],
            description: 'Quanto o som sustenta o evento.',
          },
        },
        required: [
          'startSeconds',
          'endSeconds',
          'excerpt',
          'category',
          'auditoryEvidence',
          'confidence',
        ],
      },
    },
  },
  required: [
    'audioUsability',
    'limitations',
    'literalTranscript',
    'mainMessage',
    'attemptedStructure',
    'deliverySummary',
    'candidateEvents',
  ],
} as const

const CandidateEventSchema = Type.Object(
  {
    startSeconds: Type.Number({ minimum: 0 }),
    endSeconds: Type.Number({ minimum: 0 }),
    excerpt: Type.String({ minLength: 1, maxLength: MAX_EXCERPT_LENGTH }),
    category: Type.Union(MOMENT_CATEGORIES.map((category) => Type.Literal(category))),
    auditoryEvidence: Type.String({ minLength: 1, maxLength: MAX_EVIDENCE_LENGTH }),
    confidence: Type.Union(FEEDBACK_CONFIDENCES.map((confidence) => Type.Literal(confidence))),
  },
  { additionalProperties: false },
)

export const AuditoryObservationSchema = Type.Object(
  {
    audioUsability: Type.Union(AUDIO_USABILITIES.map((usability) => Type.Literal(usability))),
    limitations: Type.Array(Type.String({ minLength: 1, maxLength: MAX_LIMITATION_LENGTH }), {
      maxItems: MAX_AUDITORY_LIMITATIONS,
    }),
    literalTranscript: Type.String({ minLength: 1, maxLength: MAX_TRANSCRIPT_LENGTH }),
    mainMessage: Type.String({ minLength: 1, maxLength: MAX_MESSAGE_LENGTH }),
    attemptedStructure: Type.String({ minLength: 1, maxLength: MAX_MESSAGE_LENGTH }),
    deliverySummary: Type.String({ minLength: 1, maxLength: MAX_SUMMARY_LENGTH }),
    candidateEvents: Type.Array(CandidateEventSchema, {
      maxItems: MAX_AUDITORY_CANDIDATE_EVENTS,
    }),
  },
  { additionalProperties: false },
)

export function parseAuditoryObservation(
  raw: unknown,
  durationSeconds: number,
): AuditoryObservation {
  if (!Value.Check(AuditoryObservationSchema, raw)) {
    throw new MalformedAuditoryAnalysisError('schema')
  }

  requireText(raw.literalTranscript, 'literalTranscript')
  requireText(raw.mainMessage, 'mainMessage')
  requireText(raw.attemptedStructure, 'attemptedStructure')
  requireText(raw.deliverySummary, 'deliverySummary')
  raw.limitations.forEach((limitation, index) => {
    requireText(limitation, `limitations[${index}]`)
  })
  raw.candidateEvents.forEach((event, index) => {
    requireEvent(event, index, durationSeconds)
  })

  return raw
}

function requireEvent(event: AuditoryCandidateEvent, index: number, durationSeconds: number): void {
  requireText(event.excerpt, `candidateEvents[${index}].excerpt`)
  requireText(event.auditoryEvidence, `candidateEvents[${index}].auditoryEvidence`)

  const withinAudio =
    Number.isFinite(event.startSeconds) &&
    Number.isFinite(event.endSeconds) &&
    event.startSeconds <= event.endSeconds &&
    event.endSeconds <= durationSeconds + TIMESTAMP_TOLERANCE_SECONDS

  if (!withinAudio) {
    throw new MalformedAuditoryAnalysisError(`candidateEvents[${index}]`)
  }
}

function requireText(value: string, field: string): void {
  if (value.trim().length === 0 || MARKUP_PATTERN.test(value)) {
    throw new MalformedAuditoryAnalysisError(field)
  }
}
