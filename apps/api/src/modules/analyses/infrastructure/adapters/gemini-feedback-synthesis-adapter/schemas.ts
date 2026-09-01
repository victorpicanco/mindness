import { Type } from 'typebox'
import { Value } from 'typebox/value'

import { InvalidCommunicationFeedbackError } from '@/modules/analyses/domain/errors/invalid-communication-feedback-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import {
  ALIGNMENT_QUALITIES,
  AUDIO_USABILITIES,
  CommunicationFeedback,
  FEEDBACK_CONFIDENCES,
  MOMENT_CATEGORIES,
  MOMENT_VALENCES,
  TIMING_BASES,
} from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'

const MAX_SHORT_TEXT_LENGTH = 300
const MAX_TEXT_LENGTH = 1_000
const MAX_TRANSCRIPT_LENGTH = 20_000

const ShortText = Type.String({ minLength: 1, maxLength: MAX_SHORT_TEXT_LENGTH })
const Text = Type.String({ minLength: 1, maxLength: MAX_TEXT_LENGTH })
const Seconds = Type.Number({ minimum: 0 })
const MomentId = Type.String({ pattern: '^M[1-9][0-9]*$' })

function literals<T extends string>(values: readonly T[]) {
  return Type.Union(values.map((value) => Type.Literal(value)))
}

export const SynthesizedFeedbackSchema = Type.Object(
  {
    audioUsability: literals(AUDIO_USABILITIES),
    alignmentQuality: literals(ALIGNMENT_QUALITIES),
    limitations: Type.Array(Text, { maxItems: 5 }),
    literalTranscript: Type.String({ minLength: 1, maxLength: MAX_TRANSCRIPT_LENGTH }),
    mainMessage: Text,
    attemptedStructure: Text,
    summary: Text,
    strengths: Type.Array(
      Type.Object(
        { title: ShortText, evidence: Text, whyItHelped: Text },
        { additionalProperties: false },
      ),
      { maxItems: 3 },
    ),
    moments: Type.Array(
      Type.Object(
        {
          id: MomentId,
          startSeconds: Seconds,
          endSeconds: Seconds,
          timingBasis: literals(TIMING_BASES),
          excerpt: Text,
          observation: Text,
          impact: Text,
          nextAttempt: Text,
          clearerAlternative: Type.Union([Text, Type.Null()]),
          categories: Type.Array(literals(MOMENT_CATEGORIES), { minItems: 1 }),
          valence: literals(MOMENT_VALENCES),
          confidence: literals(FEEDBACK_CONFIDENCES),
        },
        { additionalProperties: false },
      ),
      { maxItems: 8 },
    ),
    patterns: Type.Array(
      Type.Object(
        {
          title: ShortText,
          description: Text,
          evidenceMomentIds: Type.Array(MomentId),
          impact: Text,
          exercise: Text,
        },
        { additionalProperties: false },
      ),
      { maxItems: 5 },
    ),
    asrDivergences: Type.Array(
      Type.Object(
        {
          startSeconds: Seconds,
          endSeconds: Seconds,
          asrVersion: ShortText,
          heardVersion: ShortText,
          relevance: Text,
        },
        { additionalProperties: false },
      ),
      { maxItems: 5 },
    ),
    priorities: Type.Array(
      Type.Object(
        {
          title: ShortText,
          behavior: Text,
          evidenceMomentIds: Type.Array(MomentId),
          importance: Text,
          action: Text,
          exercise: Text,
        },
        { additionalProperties: false },
      ),
      { maxItems: 3 },
    ),
  },
  { additionalProperties: false },
)

export function parseCommunicationFeedback(
  raw: unknown,
  durationSeconds: number,
): CommunicationFeedback {
  if (!Value.Check(SynthesizedFeedbackSchema, raw)) {
    throw new MalformedEvaluationError('schema')
  }

  try {
    return CommunicationFeedback.create({ durationSeconds, ...raw })
  } catch (error: unknown) {
    if (error instanceof InvalidCommunicationFeedbackError) {
      const field = error.context.field
      throw new MalformedEvaluationError(typeof field === 'string' ? field : 'semantics')
    }
    throw error
  }
}
