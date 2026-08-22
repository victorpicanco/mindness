import { readFileSync } from 'node:fs'
import path from 'node:path'

import { DeepgramClient } from '@deepgram/sdk'
import { GoogleGenAI } from '@google/genai'
import { describe, expect, it } from 'vitest'

import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

import { CostCalculator } from '@/modules/analyses/domain/services/cost-calculator/index.js'
import { RhythmCalculator } from '@/modules/analyses/domain/services/rhythm-calculator/index.js'
import { DeepgramTranscriptionAdapter } from '@/modules/analyses/infrastructure/adapters/deepgram-transcription-adapter/index.js'
import { GeminiEvaluationAdapter } from '@/modules/analyses/infrastructure/adapters/gemini-evaluation-adapter/index.js'

// D-10 do Bloco 5: os dois tetos por fornecedor e o teto por sessão, em micro-dólares.
const TRANSCRIPTION_COST_CEILING_MICROS = 20_000
const EVALUATION_COST_CEILING_MICROS = 40_000
const SESSION_COST_CEILING_MICROS = 60_000

const FIXTURE_AUDIO_PATH = path.resolve(
  import.meta.dirname,
  '../../../modules/sessions/infrastructure/adapters/ffmpeg-audio-validation-adapter/fixtures/too-long.webm',
)

const hasProviderCredentials =
  Boolean(process.env.DEEPGRAM_API_KEY) && Boolean(process.env.GOOGLE_CLOUD_PROJECT)

function requireEnv(name: string): string {
  const value = process.env[name]
  if (value === undefined || value === '') {
    throw new OperationFailedError('Missing required environment variable', {
      context: { name },
    })
  }
  return value
}

function requireNumberEnv(name: string): number {
  const parsed = Number(requireEnv(name))
  if (!Number.isFinite(parsed)) {
    throw new OperationFailedError('Environment variable is not a finite number', {
      context: { name },
    })
  }
  return parsed
}

describe.skipIf(!hasProviderCredentials)('real provider cost measurement', () => {
  it('measures Deepgram and Gemini cost of a real 60s recording within the D-10 ceilings', async () => {
    const deepgramApiKey = requireEnv('DEEPGRAM_API_KEY')
    const googleCloudProject = requireEnv('GOOGLE_CLOUD_PROJECT')
    const googleCloudLocation = requireEnv('GOOGLE_CLOUD_LOCATION')
    const geminiModel = requireEnv('GEMINI_MODEL')
    const transcriptionCostPerMinuteMicros = requireNumberEnv('DEEPGRAM_COST_PER_MINUTE_MICROS')
    const geminiInputCostPerMtokMicros = requireNumberEnv('GEMINI_INPUT_COST_PER_MTOK_MICROS')
    const geminiOutputCostPerMtokMicros = requireNumberEnv('GEMINI_OUTPUT_COST_PER_MTOK_MICROS')

    const transcriptionAdapter = new DeepgramTranscriptionAdapter(
      new DeepgramClient({ apiKey: deepgramApiKey }),
    )
    const evaluationAdapter = new GeminiEvaluationAdapter(
      new GoogleGenAI({
        vertexai: true,
        project: googleCloudProject,
        location: googleCloudLocation,
      }),
      geminiModel,
    )

    const audio = readFileSync(FIXTURE_AUDIO_PATH)
    const controller = new AbortController()

    const transcription = await transcriptionAdapter.transcribe({
      audio,
      deadlineMs: 300_000,
      signal: controller.signal,
    })

    const [firstWord, ...remainingWords] = transcription.words
    if (firstWord === undefined) {
      throw new OperationFailedError('Fixture recording produced no transcribed words')
    }

    const rhythm = RhythmCalculator.calculate([firstWord, ...remainingWords])

    const evaluation = await evaluationAdapter.evaluate({
      themeTitle: 'Medição de custo real da suíte opt-in',
      transcript: transcription.text,
      rhythm: rhythm.metrics,
      signal: controller.signal,
    })

    const cost = CostCalculator.calculate({
      durationSeconds: transcription.durationSeconds,
      inputTokens: evaluation.inputTokens,
      outputTokens: evaluation.outputTokens,
      transcriptionCostPerMinuteMicros,
      geminiInputCostPerMtokMicros,
      geminiOutputCostPerMtokMicros,
    })

    expect(cost.transcriptionMicrosUsd).toBeLessThanOrEqual(TRANSCRIPTION_COST_CEILING_MICROS)
    expect(cost.evaluationMicrosUsd).toBeLessThanOrEqual(EVALUATION_COST_CEILING_MICROS)
    expect(cost.totalMicrosUsd).toBeLessThanOrEqual(SESSION_COST_CEILING_MICROS)
  })
})
