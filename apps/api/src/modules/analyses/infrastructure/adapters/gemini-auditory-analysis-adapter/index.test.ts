import { describe, expect, it } from 'vitest'

import { AuditoryAnalysisFailedError } from '@/modules/analyses/domain/errors/auditory-analysis-failed-error/index.js'
import { MalformedAuditoryAnalysisError } from '@/modules/analyses/domain/errors/malformed-auditory-analysis-error/index.js'
import { CANONICAL_AUDIO_CONTENT_TYPE } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'

import { GeminiAuditoryAnalysisAdapter } from './index.js'

const observation = {
  audioUsability: 'usable',
  limitations: [],
  literalTranscript: 'ééé então a comunicação é uma habilidade.',
  mainMessage: 'Comunicação é uma habilidade treinável.',
  attemptedStructure: 'Abertura, exemplo e fechamento.',
  deliverySummary: 'Ritmo irregular com quedas de volume no fim das frases.',
  candidateEvents: [
    {
      startSeconds: 0,
      endSeconds: 0.8,
      excerpt: 'ééé',
      category: 'filler',
      auditoryEvidence: 'Som de hesitação sustentado antes da primeira palavra.',
      confidence: 'high',
    },
  ],
}

interface InlineDataPart {
  readonly inlineData: { readonly mimeType: string; readonly data: string }
}

interface GenerateContentCall {
  readonly model: string
  readonly contents: { readonly role: 'user'; readonly parts: InlineDataPart[] }[]
  readonly config: {
    readonly abortSignal: AbortSignal
    readonly systemInstruction: string
    readonly audioTimestamp: true
    readonly responseMimeType: 'application/json'
    readonly responseSchema: { readonly required: readonly string[] }
    readonly thinkingConfig: { readonly thinkingBudget: 0 }
  }
}

class FakeGeminiClient {
  response: unknown = {
    text: JSON.stringify(observation),
    usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 120, thoughtsTokenCount: 0 },
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

const audio: PreparedAudio = {
  bytes: Buffer.from('flac-bytes'),
  contentType: CANONICAL_AUDIO_CONTENT_TYPE,
  durationSeconds: 42,
}

describe('GeminiAuditoryAnalysisAdapter', () => {
  it('sends the canonical audio with structured output, audio timestamps and no thinking', async () => {
    const client = new FakeGeminiClient()
    const adapter = new GeminiAuditoryAnalysisAdapter(client, 'gemini-2.5-flash')
    const controller = new AbortController()

    await expect(adapter.observe({ audio, signal: controller.signal })).resolves.toEqual({
      observation,
      inputTokens: 900,
      outputTokens: 120,
    })

    const [call] = client.calls
    expect(client.calls).toHaveLength(1)
    expect(call?.model).toBe('gemini-2.5-flash')
    expect(call?.config).toMatchObject({
      abortSignal: controller.signal,
      audioTimestamp: true,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    })
    expect(call?.config.responseSchema.required).toEqual([
      'audioUsability',
      'limitations',
      'literalTranscript',
      'mainMessage',
      'attemptedStructure',
      'deliverySummary',
      'candidateEvents',
    ])
    expect(call?.contents).toEqual([
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: CANONICAL_AUDIO_CONTENT_TYPE,
              data: audio.bytes.toString('base64'),
            },
          },
        ],
      },
    ])
  })

  it('states the auditory task in the system instruction and treats speech as untrusted data', async () => {
    const client = new FakeGeminiClient()
    const adapter = new GeminiAuditoryAnalysisAdapter(client, 'gemini-2.5-flash')

    await adapter.observe({ audio, signal: new AbortController().signal })

    const instruction = client.calls[0]?.config.systemInstruction ?? ''
    expect(instruction).toMatch(/português/i)
    expect(instruction).toMatch(/não confiáve/i)
    expect(instruction).toMatch(/diagn/i)
  })

  it('never sends a theme, a transcript or rhythm metrics alongside the audio', async () => {
    const client = new FakeGeminiClient()
    const adapter = new GeminiAuditoryAnalysisAdapter(client, 'gemini-2.5-flash')

    await adapter.observe({ audio, signal: new AbortController().signal })

    const parts = client.calls[0]?.contents.flatMap((content) => content.parts) ?? []
    expect(parts).toHaveLength(1)
    expect(parts.every((part) => 'inlineData' in part)).toBe(true)

    const instruction = client.calls[0]?.config.systemInstruction ?? ''
    expect(instruction).not.toMatch(/transcri|tema|palavras por minuto/i)
  })

  it.each([
    ['a non-JSON response', { text: 'not JSON', usageMetadata: {} }],
    ['a response without text', { usageMetadata: {} }],
    [
      'a response rejected by the observation schema',
      {
        text: JSON.stringify({ ...observation, audioUsability: 'excellent' }),
        usageMetadata: {},
      },
    ],
    [
      'an event beyond the prepared audio duration',
      {
        text: JSON.stringify({
          ...observation,
          candidateEvents: [
            { ...observation.candidateEvents[0], startSeconds: 60, endSeconds: 61 },
          ],
        }),
        usageMetadata: {},
      },
    ],
  ])('rejects %s as malformed', async (_description, response) => {
    const client = new FakeGeminiClient()
    client.response = response
    const adapter = new GeminiAuditoryAnalysisAdapter(client, 'gemini-2.5-flash')

    await expect(
      adapter.observe({ audio, signal: new AbortController().signal }),
    ).rejects.toBeInstanceOf(MalformedAuditoryAnalysisError)
  })

  it('wraps a client exception and preserves its cause', async () => {
    const client = new FakeGeminiClient()
    const cause = new TypeError('Gemini unavailable')
    client.failure = cause
    const adapter = new GeminiAuditoryAnalysisAdapter(client, 'gemini-2.5-flash')

    const promise = adapter.observe({ audio, signal: new AbortController().signal })

    await expect(promise).rejects.toBeInstanceOf(AuditoryAnalysisFailedError)
    await expect(promise).rejects.toMatchObject({
      cause,
      code: 'analyses.AUDITORY_ANALYSIS_FAILED',
    })
  })
})
