import { Type } from '@google/genai'
import { Type as TypeBox } from 'typebox'
import { Value } from 'typebox/value'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import type {
  EvaluationPort,
  EvaluationResult,
} from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import { parseEvaluationResult } from './schemas.js'

interface GeminiGenerateContentClient {
  readonly models: {
    generateContent(input: {
      readonly model: string
      readonly contents: string
      readonly config: GeminiGenerationConfig
    }): Promise<unknown>
  }
}

interface GeminiGenerationConfig {
  readonly abortSignal: AbortSignal
  readonly responseMimeType: 'application/json'
  readonly responseSchema: typeof EVALUATION_RESPONSE_SCHEMA
  readonly thinkingConfig: { readonly thinkingBudget: 0 }
}

const EVALUATION_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    clarityScore: { type: Type.INTEGER, minimum: 0, maximum: 100 },
    clarityGuidance: { type: Type.STRING },
    fluencyScore: { type: Type.INTEGER, minimum: 0, maximum: 100 },
    fluencyGuidance: { type: Type.STRING },
    masteryScore: { type: Type.INTEGER, minimum: 0, maximum: 100 },
    masteryGuidance: { type: Type.STRING },
  },
  required: [
    'clarityScore',
    'clarityGuidance',
    'fluencyScore',
    'fluencyGuidance',
    'masteryScore',
    'masteryGuidance',
  ],
} as const

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

  async evaluate(input: {
    readonly themeTitle: string
    readonly transcript: string
    readonly rhythm: RhythmMetrics
    readonly signal: AbortSignal
  }): Promise<EvaluationResult> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: this.buildPrompt(input),
        config: {
          abortSignal: input.signal,
          responseMimeType: 'application/json',
          responseSchema: EVALUATION_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      return this.parseResponse(response)
    } catch (error: unknown) {
      if (error instanceof MalformedEvaluationError) throw error
      throw new EvaluationFailedError('Gemini request failed', { cause: error })
    }
  }

  private buildPrompt(input: {
    readonly themeTitle: string
    readonly transcript: string
    readonly rhythm: RhythmMetrics
  }): string {
    return [
      `Theme title: ${input.themeTitle}`,
      `Transcript: ${input.transcript}`,
      `Rhythm metrics: words per minute ${input.rhythm.wordsPerMinute}, word count ${input.rhythm.wordCount}, speech duration seconds ${input.rhythm.speechDurationSeconds}, pause count ${input.rhythm.pauseCount}, long pause count ${input.rhythm.longPauseCount}, longest pause seconds ${input.rhythm.longestPauseSeconds}.`,
      'Evaluate clarity, fluency, and mastery. Return only the requested JSON object.',
    ].join('\n')
  }

  private parseResponse(response: unknown): EvaluationResult {
    if (!Value.Check(GeminiResponseSchema, response)) {
      throw new MalformedEvaluationError('response')
    }

    let rawEvaluation: unknown
    try {
      rawEvaluation = JSON.parse(response.text)
    } catch {
      throw new MalformedEvaluationError('text')
    }

    const usageMetadata = response.usageMetadata
    return {
      ...parseEvaluationResult(rawEvaluation),
      inputTokens: usageMetadata?.promptTokenCount ?? 0,
      outputTokens:
        (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0),
    }
  }
}
