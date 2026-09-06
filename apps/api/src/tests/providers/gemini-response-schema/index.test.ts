import { readFileSync } from 'node:fs'
import path from 'node:path'

import { GoogleGenAI } from '@google/genai'
import { describe, expect, it } from 'vitest'

import type { TranscriptionWord } from '@/modules/analyses/domain/entities/transcription/index.js'
import { FfmpegAudioPreparationAdapter } from '@/modules/analyses/infrastructure/adapters/ffmpeg-audio-preparation-adapter/index.js'
import { GeminiEvaluationAdapter } from '@/modules/analyses/infrastructure/adapters/gemini-evaluation-adapter/index.js'
import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

const FIXTURE_AUDIO_PATH = path.resolve(
  import.meta.dirname,
  '../../../modules/sessions/infrastructure/adapters/ffmpeg-audio-validation-adapter/fixtures/valid.webm',
)

const TRANSCRIPT = 'Hoje eu quero falar sobre por que ensaiar em voz alta muda o resultado.'

// The rhythm windows only count words that start inside the recording, so the fixture spreads
// them over the duration ffmpeg actually produced.
function wordsWithin(durationSeconds: number): readonly TranscriptionWord[] {
  const spoken = TRANSCRIPT.replace('.', '').split(' ')
  const step = durationSeconds / (spoken.length + 1)
  return spoken.map((word, index) => ({
    word,
    start: index * step,
    end: index * step + step / 2,
    confidence: 0.9,
  }))
}

const hasProviderCredentials = Boolean(process.env.GOOGLE_CLOUD_PROJECT)

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new OperationFailedError('Missing required environment variable', { context: { name } })
  }
  return value
}

describe.skipIf(!hasProviderCredentials)('real Gemini response schema', () => {
  it('is accepted by Vertex AI and produces feedback the parser validates', async () => {
    const adapter = new GeminiEvaluationAdapter(
      new GoogleGenAI({
        vertexai: true,
        project: requireEnv('GOOGLE_CLOUD_PROJECT'),
        location: requireEnv('GOOGLE_CLOUD_LOCATION'),
      }),
      requireEnv('GEMINI_MODEL'),
    )
    const controller = new AbortController()
    const bytes = readFileSync(FIXTURE_AUDIO_PATH)
    const audio = await new FfmpegAudioPreparationAdapter().prepare({
      source: { bytes, contentType: 'audio/webm', durationSeconds: 5 },
      signal: controller.signal,
    })

    const evaluation = await adapter.evaluate({
      audio,
      themeTitle: 'Por que ensaiar em voz alta muda o resultado',
      transcript: TRANSCRIPT,
      words: wordsWithin(audio.durationSeconds),
      signal: controller.signal,
    })

    expect(evaluation.feedback.summary.length).toBeGreaterThan(0)
    expect(evaluation.feedback.delivery).toBeDefined()
    expect(evaluation.inputTokens).toBeGreaterThan(0)
  })
})
