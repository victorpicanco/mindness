import { describe, expect, it } from 'vitest'

import { CostCalculator } from './index.js'

describe('CostCalculator', () => {
  it('calculates the transcription cost from the externally measured audio duration', () => {
    const cost = CostCalculator.calculate({
      durationSeconds: 60,
      inputTokens: 0,
      outputTokens: 0,
      transcriptionCostPerMinuteMicros: 20_000,
      geminiInputCostPerMtokMicros: 1_250_000,
      geminiOutputCostPerMtokMicros: 5_000_000,
    })

    expect(cost.transcriptionMicrosUsd).toBe(20_000)
    expect(cost.evaluationMicrosUsd).toBe(0)
    expect(cost.totalMicrosUsd).toBe(20_000)
  })

  it('bills the evaluation output tokens already summed by the evaluation port', () => {
    const cost = CostCalculator.calculate({
      durationSeconds: 0,
      inputTokens: 1_000_000,
      outputTokens: 5,
      transcriptionCostPerMinuteMicros: 20_000,
      geminiInputCostPerMtokMicros: 1_250_000,
      geminiOutputCostPerMtokMicros: 1_000_000,
    })

    expect(cost.outputTokens).toBe(5)
    expect(cost.evaluationMicrosUsd).toBe(1_250_005)
  })

  it('rounds each billed term up to an integer micro-dollar after multiplying', () => {
    const cost = CostCalculator.calculate({
      durationSeconds: 1,
      inputTokens: 1,
      outputTokens: 1,
      transcriptionCostPerMinuteMicros: 59,
      geminiInputCostPerMtokMicros: 999_999,
      geminiOutputCostPerMtokMicros: 999_999,
    })

    expect(cost.transcriptionMicrosUsd).toBe(1)
    expect(cost.evaluationMicrosUsd).toBe(2)
    expect(cost.totalMicrosUsd).toBe(3)
    expect(Number.isInteger(cost.totalMicrosUsd)).toBe(true)
  })
})
