import { Type as TypeBox } from 'typebox'
import { Value } from 'typebox/value'

import { FeedbackSynthesisFailedError } from '@/modules/analyses/domain/errors/feedback-synthesis-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import type {
  FeedbackSynthesisInput,
  FeedbackSynthesisPort,
  FeedbackSynthesisResult,
} from '@/modules/analyses/domain/ports/feedback-synthesis-port/index.js'

import { buildSynthesisContents, SYNTHESIS_SYSTEM_INSTRUCTION } from './prompt.js'
import type { SynthesisContent } from './prompt.js'
import { FEEDBACK_RESPONSE_SCHEMA, parseCommunicationFeedback } from './schemas.js'

export interface GeminiSynthesisGenerationConfig {
  readonly abortSignal: AbortSignal
  readonly systemInstruction: string
  readonly audioTimestamp: true
  readonly responseMimeType: 'application/json'
  readonly responseSchema: typeof FEEDBACK_RESPONSE_SCHEMA
  readonly thinkingConfig: {
    readonly thinkingBudget: -1
    readonly includeThoughts: false
  }
}

export interface GeminiFeedbackSynthesisClient {
  readonly models: {
    generateContent(input: {
      readonly model: string
      readonly contents: SynthesisContent[]
      readonly config: GeminiSynthesisGenerationConfig
    }): Promise<unknown>
  }
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

export class GeminiFeedbackSynthesisAdapter implements FeedbackSynthesisPort {
  constructor(
    private readonly client: GeminiFeedbackSynthesisClient,
    private readonly model: string,
  ) {}

  async synthesize(input: FeedbackSynthesisInput): Promise<FeedbackSynthesisResult> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildSynthesisContents(input),
        config: {
          abortSignal: input.signal,
          systemInstruction: SYNTHESIS_SYSTEM_INSTRUCTION,
          audioTimestamp: true,
          responseMimeType: 'application/json',
          responseSchema: FEEDBACK_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: -1, includeThoughts: false },
        },
      })

      return this.parseResponse(response, input.audio.durationSeconds)
    } catch (error: unknown) {
      if (error instanceof MalformedEvaluationError) throw error
      throw new FeedbackSynthesisFailedError('Gemini request failed', { cause: error })
    }
  }

  private parseResponse(response: unknown, durationSeconds: number): FeedbackSynthesisResult {
    if (!Value.Check(GeminiResponseSchema, response)) {
      throw new MalformedEvaluationError('response')
    }

    let rawFeedback: unknown
    try {
      rawFeedback = JSON.parse(response.text)
    } catch {
      throw new MalformedEvaluationError('text')
    }

    const usageMetadata = response.usageMetadata
    return {
      feedback: parseCommunicationFeedback(rawFeedback, durationSeconds),
      inputTokens: usageMetadata?.promptTokenCount ?? 0,
      outputTokens:
        (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0),
    }
  }
}

export { SYNTHESIS_SYSTEM_INSTRUCTION } from './prompt.js'
