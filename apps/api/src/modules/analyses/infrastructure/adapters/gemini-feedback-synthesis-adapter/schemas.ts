import { Type as GenAiType } from '@google/genai'
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

const MOMENT_ID_DESCRIPTION =
  'Identificador sequencial do momento, no formato M1, M2, M3, na ordem em que acontece.'

const geminiText = (description: string, maxLength: number) => ({
  type: GenAiType.STRING,
  maxLength: String(maxLength),
  description,
})

const geminiEnum = (values: readonly string[], description: string) => ({
  type: GenAiType.STRING,
  format: 'enum',
  enum: [...values],
  description,
})

export const FEEDBACK_RESPONSE_SCHEMA = {
  type: GenAiType.OBJECT,
  properties: {
    audioUsability: geminiEnum(
      AUDIO_USABILITIES,
      'usable quando a fala é audível do início ao fim; limited quando parte dela impede concluir; unusable quando não há fala audível suficiente.',
    ),
    alignmentQuality: geminiEnum(
      ALIGNMENT_QUALITIES,
      'Quanto a marcação de tempo automática coincide com o que se ouve.',
    ),
    limitations: {
      type: GenAiType.ARRAY,
      maxItems: '5',
      description: 'O que a gravação ou o alinhamento impediram de concluir.',
      items: geminiText('Limitação observável, sem especular a causa.', MAX_TEXT_LENGTH),
    },
    literalTranscript: geminiText(
      'Tudo o que foi dito, preservando marcas de oralidade claramente audíveis.',
      MAX_TRANSCRIPT_LENGTH,
    ),
    mainMessage: geminiText('A mensagem principal que a fala entrega.', MAX_TEXT_LENGTH),
    attemptedStructure: geminiText(
      'A organização que a pessoa tentou dar à fala, na ordem em que apareceu.',
      MAX_TEXT_LENGTH,
    ),
    summary: geminiText(
      'Resumo da performance em duas a quatro frases, dirigido à pessoa que falou.',
      MAX_TEXT_LENGTH,
    ),
    strengths: {
      type: GenAiType.ARRAY,
      maxItems: '3',
      description: 'O que funcionou, sustentado por evidência da própria gravação.',
      items: {
        type: GenAiType.OBJECT,
        properties: {
          title: geminiText('Nome curto do ponto positivo.', MAX_SHORT_TEXT_LENGTH),
          evidence: geminiText('O trecho ou comportamento que sustenta o ponto.', MAX_TEXT_LENGTH),
          whyItHelped: geminiText('Por que isso ajudou quem ouviu.', MAX_TEXT_LENGTH),
        },
        required: ['title', 'evidence', 'whyItHelped'],
      },
    },
    moments: {
      type: GenAiType.ARRAY,
      maxItems: '8',
      description: 'Momentos relevantes da gravação, com o intervalo em que acontecem.',
      items: {
        type: GenAiType.OBJECT,
        properties: {
          id: { type: GenAiType.STRING, description: MOMENT_ID_DESCRIPTION },
          startSeconds: {
            type: GenAiType.NUMBER,
            minimum: 0,
            description: 'Início do momento, em segundos desde o começo da gravação.',
          },
          endSeconds: {
            type: GenAiType.NUMBER,
            minimum: 0,
            description: 'Fim do momento, em segundos, nunca antes do início.',
          },
          timingBasis: geminiEnum(
            TIMING_BASES,
            'asr quando o intervalo vem da marcação automática; audio quando vem da escuta.',
          ),
          excerpt: geminiText('O trecho falado tal como soou.', MAX_TEXT_LENGTH),
          observation: geminiText('O que acontece nesse trecho, em uma frase.', MAX_TEXT_LENGTH),
          impact: geminiText('O efeito disso sobre quem ouve.', MAX_TEXT_LENGTH),
          nextAttempt: geminiText('O que fazer diferente na próxima tentativa.', MAX_TEXT_LENGTH),
          clearerAlternative: {
            type: GenAiType.STRING,
            nullable: true,
            maxLength: String(MAX_TEXT_LENGTH),
            description: 'Uma forma mais clara de dizer o mesmo, ou null quando não ajudar.',
          },
          categories: {
            type: GenAiType.ARRAY,
            minItems: '1',
            description: 'As categorias audíveis do momento.',
            items: geminiEnum(MOMENT_CATEGORIES, 'Categoria audível do momento.'),
          },
          valence: geminiEnum(MOMENT_VALENCES, 'Se o momento ajudou, foi neutro ou atrapalhou.'),
          confidence: geminiEnum(FEEDBACK_CONFIDENCES, 'Quanto a gravação sustenta o momento.'),
        },
        required: [
          'id',
          'startSeconds',
          'endSeconds',
          'timingBasis',
          'excerpt',
          'observation',
          'impact',
          'nextAttempt',
          'clearerAlternative',
          'categories',
          'valence',
          'confidence',
        ],
      },
    },
    patterns: {
      type: GenAiType.ARRAY,
      maxItems: '5',
      description: 'Padrões recorrentes, cada um sustentado por pelo menos dois momentos.',
      items: {
        type: GenAiType.OBJECT,
        properties: {
          title: geminiText('Nome curto do padrão.', MAX_SHORT_TEXT_LENGTH),
          description: geminiText('O que se repete ao longo da fala.', MAX_TEXT_LENGTH),
          evidenceMomentIds: {
            type: GenAiType.ARRAY,
            minItems: '2',
            description: 'Identificadores de pelo menos dois momentos distintos desta resposta.',
            items: { type: GenAiType.STRING, description: MOMENT_ID_DESCRIPTION },
          },
          impact: geminiText('O efeito do padrão sobre quem ouve.', MAX_TEXT_LENGTH),
          exercise: geminiText('Um exercício curto para trabalhar o padrão.', MAX_TEXT_LENGTH),
        },
        required: ['title', 'description', 'evidenceMomentIds', 'impact', 'exercise'],
      },
    },
    asrDivergences: {
      type: GenAiType.ARRAY,
      maxItems: '5',
      description: 'Trechos em que a transcrição automática diverge do que se ouve.',
      items: {
        type: GenAiType.OBJECT,
        properties: {
          startSeconds: {
            type: GenAiType.NUMBER,
            minimum: 0,
            description: 'Início do trecho divergente, em segundos.',
          },
          endSeconds: {
            type: GenAiType.NUMBER,
            minimum: 0,
            description: 'Fim do trecho divergente, em segundos.',
          },
          asrVersion: geminiText(
            'O que a transcrição automática registrou.',
            MAX_SHORT_TEXT_LENGTH,
          ),
          heardVersion: geminiText('O que de fato se ouve na gravação.', MAX_SHORT_TEXT_LENGTH),
          relevance: geminiText('Por que a divergência importa para o feedback.', MAX_TEXT_LENGTH),
        },
        required: ['startSeconds', 'endSeconds', 'asrVersion', 'heardVersion', 'relevance'],
      },
    },
    priorities: {
      type: GenAiType.ARRAY,
      maxItems: '3',
      description: 'O que trabalhar primeiro na próxima tentativa.',
      items: {
        type: GenAiType.OBJECT,
        properties: {
          title: geminiText('Nome curto da prioridade.', MAX_SHORT_TEXT_LENGTH),
          behavior: geminiText('O comportamento observado que ela endereça.', MAX_TEXT_LENGTH),
          evidenceMomentIds: {
            type: GenAiType.ARRAY,
            description: 'Identificadores de momentos desta resposta que sustentam a prioridade.',
            items: { type: GenAiType.STRING, description: MOMENT_ID_DESCRIPTION },
          },
          importance: geminiText('Por que ela vem antes das outras.', MAX_TEXT_LENGTH),
          action: geminiText('A ação concreta para a próxima gravação.', MAX_TEXT_LENGTH),
          exercise: geminiText('Um exercício curto para treinar a ação.', MAX_TEXT_LENGTH),
        },
        required: ['title', 'behavior', 'evidenceMomentIds', 'importance', 'action', 'exercise'],
      },
    },
  },
  required: [
    'audioUsability',
    'alignmentQuality',
    'limitations',
    'literalTranscript',
    'mainMessage',
    'attemptedStructure',
    'summary',
    'strengths',
    'moments',
    'patterns',
    'asrDivergences',
    'priorities',
  ],
} as const

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
