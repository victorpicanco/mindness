import { describe, expect, it } from 'vitest'

import { CostCalculator } from './index.js'

describe('CostCalculator', () => {
  it('adds one transcription and one Gemini request', () => {
    expect(
      CostCalculator.calculate({
        durationSeconds: 30,
        inputTokens: 1_000,
        outputTokens: 500,
        transcriptionCostPerMinuteMicros: 4_800,
        geminiInputCostPerMtokMicros: 300_000,
        geminiOutputCostPerMtokMicros: 2_500_000,
      }),
    ).toEqual({
      transcriptionMicrosUsd: 2_400,
      evaluationMicrosUsd: 1_550,
      totalMicrosUsd: 3_950,
      outputTokens: 500,
    })
  })
})
