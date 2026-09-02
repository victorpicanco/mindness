import { describe, expect, it } from 'vitest'

import { EvaluationFailedError } from '@/modules/analyses/domain/errors/evaluation-failed-error/index.js'
import { MalformedEvaluationError } from '@/modules/analyses/domain/errors/malformed-evaluation-error/index.js'
import { CANONICAL_AUDIO_CONTENT_TYPE } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'

import { GeminiEvaluationAdapter, type GeminiGenerateContentClient } from './index.js'

const feedback = {
  summary: 'A mensagem foi clara e a entrega manteve um ritmo natural.',
  strengths: [{ title: 'Abertura direta', evidence: 'A ideia principal aparece no início.' }],
  improvements: [
    {
      title: 'Fechamento mais firme',
      evidence: 'A última frase perde energia.',
      action: 'Encerre repetindo a mensagem principal em uma frase.',
    },
  ],
}

type GenerateContentCall = Parameters<GeminiGenerateContentClient['models']['generateContent']>[0]

class FakeGeminiClient implements GeminiGenerateContentClient {
  response: unknown = {
    text: JSON.stringify(feedback),
    usageMetadata: { promptTokenCount: 123, candidatesTokenCount: 45, thoughtsTokenCount: 7 },
  }
  failure: Error | null = null
  readonly calls: GenerateContentCall[] = []
  readonly models = {
    generateContent: (call: GenerateContentCall): Promise<unknown> => {
      this.calls.push(call)
      if (this.failure !== null) return Promise.reject(this.failure)
      return Promise.resolve(this.response)
    },
  }
}

function createInput(signal: AbortSignal): Parameters<GeminiEvaluationAdapter['evaluate']>[0] {
  return {
    audio: {
      bytes: Buffer.from('flac-bytes'),
      contentType: CANONICAL_AUDIO_CONTENT_TYPE,
      durationSeconds: 30,
    },
    themeTitle: 'Comunicação clara',
    transcript: 'Uma apresentação sobre comunicação clara.',
    words: [{ word: 'comunicação', start: 1.2, end: 1.8, confidence: 0.98 }],
    signal,
  }
}

describe('GeminiEvaluationAdapter', () => {
  it('sends audio, transcript and timestamped words in one structured request', async () => {
    const client = new FakeGeminiClient()
    const controller = new AbortController()
    const adapter = new GeminiEvaluationAdapter(client, 'gemini-2.5-flash')

    await expect(adapter.evaluate(createInput(controller.signal))).resolves.toEqual({
      feedback,
      inputTokens: 123,
      outputTokens: 52,
    })

    const call = client.calls[0]
    expect(call?.model).toBe('gemini-2.5-flash')
    expect(call?.config).toMatchObject({
      abortSignal: controller.signal,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
      responseSchema: { required: ['summary', 'strengths', 'improvements'] },
    })
    expect(call?.contents[0]?.parts).toEqual([
      {
        inlineData: {
          data: Buffer.from('flac-bytes').toString('base64'),
          mimeType: CANONICAL_AUDIO_CONTENT_TYPE,
        },
      },
      {
        text: [
          'Analise a apresentação oral anexada seguindo integralmente o protocolo do sistema.',
          '',
          '<contexto_da_tentativa>',
          'Idioma: português brasileiro',
          'Tipo: apresentação curta e improvisada',
          'Tema: Comunicação clara',
          'Unidade dos timestamps: segundos desde o início da gravação',
          '</contexto_da_tentativa>',
          '',
          '<transcricao_asr>',
          'Uma apresentação sobre comunicação clara.',
          '</transcricao_asr>',
          '',
          '<palavras_com_timestamps>',
          '[{"word":"comunicação","start":1.2,"end":1.8,"confidence":0.98}]',
          '</palavras_com_timestamps>',
        ].join('\n'),
      },
    ])
  })

  it('treats every user-controlled input as data and never asks for scores', async () => {
    const client = new FakeGeminiClient()
    const adapter = new GeminiEvaluationAdapter(client, 'gemini-2.5-flash')

    await adapter.evaluate(createInput(new AbortController().signal))

    expect(client.calls[0]?.config.systemInstruction).toMatch(
      /^Você é o sistema de análise de comunicação oral do Mindness\./,
    )
    expect(client.calls[0]?.config.systemInstruction).toContain('<protocolo_de_analise>')
    expect(client.calls[0]?.config.systemInstruction).toContain(
      'Não exponha seu raciocínio intermediário.',
    )
    expect(client.calls[0]?.config.systemInstruction).toContain(
      'Responda exclusivamente de acordo com o schema estruturado configurado.',
    )
    expect(Object.keys(client.calls[0]?.config.responseSchema.properties ?? {})).toEqual([
      'summary',
      'strengths',
      'improvements',
    ])
  })

  it.each([
    ['non-JSON text', { text: 'not JSON', usageMetadata: {} }],
    ['invalid feedback', { text: JSON.stringify({ ...feedback, score: 100 }), usageMetadata: {} }],
  ])('rejects %s', async (_description, response) => {
    const client = new FakeGeminiClient()
    client.response = response

    await expect(
      new GeminiEvaluationAdapter(client, 'model').evaluate(
        createInput(new AbortController().signal),
      ),
    ).rejects.toBeInstanceOf(MalformedEvaluationError)
  })

  it('wraps provider failures and preserves the cause', async () => {
    const client = new FakeGeminiClient()
    const cause = new TypeError('Gemini unavailable')
    client.failure = cause

    await expect(
      new GeminiEvaluationAdapter(client, 'model').evaluate(
        createInput(new AbortController().signal),
      ),
    ).rejects.toMatchObject({ cause, code: 'analyses.EVALUATION_FAILED' })
    await expect(
      new GeminiEvaluationAdapter(client, 'model').evaluate(
        createInput(new AbortController().signal),
      ),
    ).rejects.toBeInstanceOf(EvaluationFailedError)
  })
})
