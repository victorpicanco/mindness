import { Type as TypeBox } from 'typebox'
import { Value } from 'typebox/value'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import type {
  EvaluationPort,
  EvaluationResult,
} from '@/modules/analyses/domain/ports/evaluation-port/index.js'

import { EvaluationFeedbackSchema, parseEvaluationFeedback } from './schemas.js'
import { SpeechMeasurements } from '@/modules/analyses/domain/services/speech-measurements/index.js'
import type { RhythmMeasurements } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import { buildUserPrompt, SYSTEM_INSTRUCTION } from './prompt.js'

interface InlineDataPart {
  readonly inlineData: { readonly mimeType: string; readonly data: string }
}

interface TextPart {
  readonly text: string
}

type GeminiPart = InlineDataPart | TextPart

export interface GeminiGenerateContentClient {
  readonly models: {
    generateContent(input: {
      readonly model: string
      readonly contents: {
        readonly role: 'user'
        readonly parts: GeminiPart[]
      }[]
      readonly config: GeminiGenerationConfig
    }): Promise<unknown>
  }
}

interface GeminiGenerationConfig {
  readonly abortSignal: AbortSignal
  readonly responseMimeType: 'application/json'
  readonly responseJsonSchema: typeof EvaluationFeedbackSchema
  readonly systemInstruction: string
  readonly thinkingConfig: { readonly thinkingBudget: 0 }
}

const GeminiResponseSchema = TypeBox.Object({
  text: TypeBox.String(),
  usageMetadata: TypeBox.Optional(
    TypeBox.Object({
      promptTokenCount: TypeBox.Optional(TypeBox.Integer({ minimum: 0 })),
      candidatesTokenCount: TypeBox.Optional(TypeBox.Integer({ minimum: 0 })),
      thoughtsTokenCount: TypeBox.Optional(TypeBox.Integer({ minimum: 0 })),
    }),
  ),
})

export class GeminiEvaluationAdapter implements EvaluationPort {
  constructor(
    private readonly client: GeminiGenerateContentClient,
    private readonly model: string,
  ) {}

  async evaluate(input: Parameters<EvaluationPort['evaluate']>[0]): Promise<EvaluationResult> {
    try {
      const metrics = SpeechMeasurements.rhythm(input.words, input.audio.durationSeconds)
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: input.audio.contentType,
                  data: input.audio.bytes.toString('base64'),
                },
              },
              { text: buildUserPrompt({ ...input, metrics }) },
            ],
          },
        ],
        config: {
          abortSignal: input.signal,
          responseMimeType: 'application/json',
          responseJsonSchema: EvaluationFeedbackSchema,
          systemInstruction: SYSTEM_INSTRUCTION,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      return this.parseResponse(response, metrics)
    } catch (error: unknown) {
      if (error instanceof MalformedEvaluationError) throw error
      throw new EvaluationFailedError('Gemini request failed', { cause: error })
    }
  }

  private parseResponse(response: unknown, metrics: RhythmMeasurements): EvaluationResult {
    if (!Value.Check(GeminiResponseSchema, response)) {
      throw new MalformedEvaluationError('response')
    }

    let rawFeedback: unknown
    try {
      rawFeedback = JSON.parse(response.text)
    } catch {
      throw new MalformedEvaluationError('text')
    }

    const usage = response.usageMetadata
    return {
      feedback: parseEvaluationFeedback(rawFeedback, metrics, this.model),
      inputTokens: usage?.promptTokenCount ?? 0,
      outputTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
    }
  }
}
