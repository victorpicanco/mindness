import { describe, expect, it } from 'vitest'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import { GeminiEvaluationAdapter } from './index.js'

interface GenerateContentConfig {
  readonly abortSignal: AbortSignal
  readonly responseMimeType: 'application/json'
  readonly responseSchema: {
    readonly required: readonly string[]
    readonly properties: {
      readonly clarityScore: { readonly minimum: 0; readonly maximum: 100 }
      readonly fluencyScore: { readonly minimum: 0; readonly maximum: 100 }
      readonly masteryScore: { readonly minimum: 0; readonly maximum: 100 }
    }
  }
  readonly thinkingConfig: { readonly thinkingBudget: 0 }
}

interface GenerateContentCall {
  readonly model: string
  readonly contents: string
  readonly config: GenerateContentConfig
}

class FakeGeminiClient {
  response: unknown = {
    text: JSON.stringify({
      clarityScore: 82,
      clarityGuidance: 'Sua explicação ficou clara e bem organizada.',
      fluencyScore: 75,
      fluencyGuidance: 'Mantenha frases curtas para ganhar fluidez.',
      masteryScore: 91,
      masteryGuidance: 'Você demonstrou domínio consistente do assunto.',
    }),
    usageMetadata: {
      promptTokenCount: 123,
      candidatesTokenCount: 45,
      thoughtsTokenCount: 7,
    },
  }
  failure: Error | null = null
  readonly calls: GenerateContentCall[] = []

  readonly models = {
    generateContent: async (call: GenerateContentCall): Promise<unknown> => {
      this.calls.push(call)
      if (this.failure !== null) return Promise.reject(this.failure)
      return this.response
    },
  }
}

const rhythm = RhythmMetrics.create({
  wordsPerMinute: 145,
  wordCount: 12,
  speechDurationSeconds: 5,
  pauseCount: 2,
  longPauseCount: 0,
  longestPauseSeconds: 0.5,
})

function createInput(signal: AbortSignal) {
  return {
    themeTitle: 'Comunicação clara',
    transcript: 'Uma apresentação sobre comunicação clara.',
    rhythm,
    signal,
  }
}

describe('GeminiEvaluationAdapter', () => {
  it('requests a schema-constrained JSON evaluation without sending audio', async () => {
    const client = new FakeGeminiClient()
    const adapter = new GeminiEvaluationAdapter(client, 'gemini-2.5-flash')
    const controller = new AbortController()

    await expect(adapter.evaluate(createInput(controller.signal))).resolves.toEqual({
      clarityScore: 82,
      clarityGuidance: 'Sua explicação ficou clara e bem organizada.',
      fluencyScore: 75,
      fluencyGuidance: 'Mantenha frases curtas para ganhar fluidez.',
      masteryScore: 91,
      masteryGuidance: 'Você demonstrou domínio consistente do assunto.',
      inputTokens: 123,
      outputTokens: 52,
    })
    expect(client.calls).toHaveLength(1)

    const [call] = client.calls
    expect(call).toBeDefined()
    expect(call?.model).toBe('gemini-2.5-flash')
    expect(call?.config).toMatchObject({
      abortSignal: controller.signal,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: {
        required: [
          'clarityScore',
          'clarityGuidance',
          'fluencyScore',
          'fluencyGuidance',
          'masteryScore',
          'masteryGuidance',
        ],
        properties: {
          clarityScore: { minimum: 0, maximum: 100 },
          fluencyScore: { minimum: 0, maximum: 100 },
          masteryScore: { minimum: 0, maximum: 100 },
        },
      },
    })
    expect(call?.contents).toContain('Comunicação clara')
    expect(call?.contents).toContain('Uma apresentação sobre comunicação clara.')
    expect(call?.contents).toContain('145')
    expect(call?.contents).not.toMatch(/Buffer|base64|audio/i)
  })

  it.each([
    ['a non-JSON response', { text: 'not JSON', usageMetadata: {} }],
    [
      'a response rejected by the evaluation schema',
      {
        text: JSON.stringify({
          clarityScore: 101,
          clarityGuidance: 'Sua explicação ficou clara e bem organizada.',
          fluencyScore: 75,
          fluencyGuidance: 'Mantenha frases curtas para ganhar fluidez.',
          masteryScore: 91,
          masteryGuidance: 'Você demonstrou domínio consistente do assunto.',
        }),
        usageMetadata: {},
      },
    ],
  ])('rejects %s as malformed', async (_description, response) => {
    const client = new FakeGeminiClient()
    client.response = response
    const adapter = new GeminiEvaluationAdapter(client, 'gemini-2.5-flash')

    await expect(
      adapter.evaluate(createInput(new AbortController().signal)),
    ).rejects.toBeInstanceOf(MalformedEvaluationError)
  })

  it('wraps a client exception and preserves its cause', async () => {
    const client = new FakeGeminiClient()
    const cause = new TypeError('Gemini unavailable')
    client.failure = cause
    const adapter = new GeminiEvaluationAdapter(client, 'gemini-2.5-flash')

    await expect(adapter.evaluate(createInput(new AbortController().signal))).rejects.toMatchObject(
      {
        cause,
        code: 'analyses.EVALUATION_FAILED',
      },
    )
    await expect(
      adapter.evaluate(createInput(new AbortController().signal)),
    ).rejects.toBeInstanceOf(EvaluationFailedError)
  })
})
