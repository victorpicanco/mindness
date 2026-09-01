import { Type as TypeBox } from 'typebox'
import { Value } from 'typebox/value'

import { AuditoryAnalysisFailedError } from '@/modules/analyses/domain/errors/auditory-analysis-failed-error/index.js'
import { MalformedAuditoryAnalysisError } from '@/modules/analyses/domain/errors/malformed-auditory-analysis-error/index.js'
import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type {
  AuditoryAnalysisPort,
  AuditoryAnalysisResult,
} from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'

import { AUDITORY_SYSTEM_INSTRUCTION, buildAuditoryContents } from './prompt.js'
import type { AuditoryContent } from './prompt.js'
import { AUDITORY_RESPONSE_SCHEMA, parseAuditoryObservation } from './schemas.js'

export interface GeminiAuditoryGenerationConfig {
  readonly abortSignal: AbortSignal
  readonly systemInstruction: string
  readonly audioTimestamp: true
  readonly responseMimeType: 'application/json'
  readonly responseSchema: typeof AUDITORY_RESPONSE_SCHEMA
  readonly thinkingConfig: { readonly thinkingBudget: 0 }
}

export interface GeminiAuditoryAnalysisClient {
  readonly models: {
    generateContent(input: {
      readonly model: string
      readonly contents: AuditoryContent[]
      readonly config: GeminiAuditoryGenerationConfig
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

export class GeminiAuditoryAnalysisAdapter implements AuditoryAnalysisPort {
  constructor(
    private readonly client: GeminiAuditoryAnalysisClient,
    private readonly model: string,
  ) {}

  async observe(input: {
    readonly audio: PreparedAudio
    readonly signal: AbortSignal
  }): Promise<AuditoryAnalysisResult> {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: buildAuditoryContents(input.audio),
        config: {
          abortSignal: input.signal,
          systemInstruction: AUDITORY_SYSTEM_INSTRUCTION,
          audioTimestamp: true,
          responseMimeType: 'application/json',
          responseSchema: AUDITORY_RESPONSE_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      })

      return this.parseResponse(response, input.audio.durationSeconds)
    } catch (error: unknown) {
      if (error instanceof MalformedAuditoryAnalysisError) throw error
      throw new AuditoryAnalysisFailedError('Gemini request failed', { cause: error })
    }
  }

  private parseResponse(response: unknown, durationSeconds: number): AuditoryAnalysisResult {
    if (!Value.Check(GeminiResponseSchema, response)) {
      throw new MalformedAuditoryAnalysisError('response')
    }

    let rawObservation: unknown
    try {
      rawObservation = JSON.parse(response.text)
    } catch {
      throw new MalformedAuditoryAnalysisError('text')
    }

    const usageMetadata = response.usageMetadata
    return {
      observation: parseAuditoryObservation(rawObservation, durationSeconds),
      inputTokens: usageMetadata?.promptTokenCount ?? 0,
      outputTokens:
        (usageMetadata?.candidatesTokenCount ?? 0) + (usageMetadata?.thoughtsTokenCount ?? 0),
    }
  }
}

export { AUDITORY_SYSTEM_INSTRUCTION } from './prompt.js'
