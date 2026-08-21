import { describe, expect, it } from 'vitest'

import { TranscriptionFailedError } from '@/modules/analyses/domain/errors/transcription-failed-error/index.js'

import { DeepgramTranscriptionAdapter } from './index.js'

interface TranscriptionRequest {
  readonly model: 'nova-3'
  readonly language: 'pt-BR'
  readonly punctuate: true
  readonly smart_format: true
}

interface RequestOptions {
  readonly timeoutInSeconds: number
  readonly maxRetries: 0
  readonly abortSignal: AbortSignal
}

interface Call {
  readonly audio: Buffer
  readonly request: TranscriptionRequest
  readonly requestOptions: RequestOptions
}

class FakeDeepgramClient {
  response: unknown = {
    results: {
      channels: [
        {
          alternatives: [
            {
              transcript: 'Uma apresentação clara.',
              confidence: 0.91,
              words: [
                { word: 'Uma', start: 0, end: 0.2, confidence: 0.95 },
                { word: 'apresentação', start: 0.3, end: 0.9, confidence: 0.87 },
              ],
            },
          ],
        },
      ],
    },
    metadata: { duration: 1.2 },
  }
  failure: Error | null = null
  readonly calls: Call[] = []

  readonly listen = {
    v1: {
      media: {
        transcribeFile: async (
          audio: Buffer,
          request: TranscriptionRequest,
          requestOptions: RequestOptions,
        ): Promise<unknown> => {
          this.calls.push({ audio, request, requestOptions })
          if (this.failure !== null) return Promise.reject(this.failure)
          return this.response
        },
      },
    },
  }
}

describe('DeepgramTranscriptionAdapter', () => {
  it('transcribes Portuguese audio with the required Deepgram request options', async () => {
    const client = new FakeDeepgramClient()
    const adapter = new DeepgramTranscriptionAdapter(client)
    const controller = new AbortController()
    const audio = Buffer.from('audio')

    await expect(
      adapter.transcribe({ audio, deadlineMs: 3_999, signal: controller.signal }),
    ).resolves.toEqual({
      text: 'Uma apresentação clara.',
      words: [
        { word: 'Uma', start: 0, end: 0.2, confidence: 0.95 },
        { word: 'apresentação', start: 0.3, end: 0.9, confidence: 0.87 },
      ],
      averageConfidence: 0.91,
      durationSeconds: 1.2,
    })
    expect(client.calls).toEqual([
      {
        audio,
        request: {
          model: 'nova-3',
          language: 'pt-BR',
          punctuate: true,
          smart_format: true,
        },
        requestOptions: {
          timeoutInSeconds: 3,
          maxRetries: 0,
          abortSignal: controller.signal,
        },
      },
    ])
  })

  it.each([
    ['missing alternative', { results: { channels: [{}] }, metadata: { duration: 1 } }],
    [
      'word missing start',
      {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: 'Olá',
                  confidence: 0.9,
                  words: [{ word: 'Olá', end: 0.2, confidence: 0.9 }],
                },
              ],
            },
          ],
        },
        metadata: { duration: 1 },
      },
    ],
    [
      'word missing end',
      {
        results: {
          channels: [
            {
              alternatives: [
                {
                  transcript: 'Olá',
                  confidence: 0.9,
                  words: [{ word: 'Olá', start: 0, confidence: 0.9 }],
                },
              ],
            },
          ],
        },
        metadata: { duration: 1 },
      },
    ],
  ])('rejects a response with %s', async (_description, response) => {
    const client = new FakeDeepgramClient()
    client.response = response
    const adapter = new DeepgramTranscriptionAdapter(client)

    await expect(
      adapter.transcribe({
        audio: Buffer.from('audio'),
        deadlineMs: 1_000,
        signal: new AbortController().signal,
      }),
    ).rejects.toBeInstanceOf(TranscriptionFailedError)
  })

  it('does not call Deepgram when the signal is already aborted', async () => {
    const client = new FakeDeepgramClient()
    const adapter = new DeepgramTranscriptionAdapter(client)
    const controller = new AbortController()
    controller.abort()

    await expect(
      adapter.transcribe({
        audio: Buffer.from('audio'),
        deadlineMs: 1_000,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(TranscriptionFailedError)
    expect(client.calls).toEqual([])
  })

  it('wraps a client exception and preserves its cause', async () => {
    const client = new FakeDeepgramClient()
    const cause = new TypeError('Deepgram unavailable')
    client.failure = cause
    const adapter = new DeepgramTranscriptionAdapter(client)

    await expect(
      adapter.transcribe({
        audio: Buffer.from('audio'),
        deadlineMs: 1_000,
        signal: new AbortController().signal,
      }),
    ).rejects.toMatchObject({ cause, code: 'analyses.TRANSCRIPTION_FAILED' })
  })
})
