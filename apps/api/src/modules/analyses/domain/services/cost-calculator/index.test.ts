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

describe('CostCalculator.calculateMultimodal', () => {
  it('bills each Gemini pass separately and keeps the evaluation total as their sum', () => {
    const cost = CostCalculator.calculateMultimodal({
      durationSeconds: 0,
      auditory: { inputTokens: 2_000_000, outputTokens: 1_000_000 },
      synthesis: { inputTokens: 3_000_000, outputTokens: 4_000_000 },
      transcriptionCostPerMinuteMicros: 20_000,
      geminiInputCostPerMtokMicros: 1_000_000,
      geminiOutputCostPerMtokMicros: 2_000_000,
    })

    expect(cost.auditoryMicrosUsd).toBe(4_000_000)
    expect(cost.synthesisMicrosUsd).toBe(11_000_000)
    expect(cost.evaluationMicrosUsd).toBe(cost.auditoryMicrosUsd + cost.synthesisMicrosUsd)
  })

  it('bills the transcription once and adds it to both Gemini passes', () => {
    const cost = CostCalculator.calculateMultimodal({
      durationSeconds: 30,
      auditory: { inputTokens: 1_000_000, outputTokens: 0 },
      synthesis: { inputTokens: 1_000_000, outputTokens: 0 },
      transcriptionCostPerMinuteMicros: 20_000,
      geminiInputCostPerMtokMicros: 1_000_000,
      geminiOutputCostPerMtokMicros: 2_000_000,
    })

    expect(cost.transcriptionMicrosUsd).toBe(10_000)
    expect(cost.totalMicrosUsd).toBe(2_010_000)
  })

  it('rounds each billed term of each pass up to an integer micro-dollar', () => {
    const cost = CostCalculator.calculateMultimodal({
      durationSeconds: 1,
      auditory: { inputTokens: 1, outputTokens: 1 },
      synthesis: { inputTokens: 1, outputTokens: 1 },
      transcriptionCostPerMinuteMicros: 59,
      geminiInputCostPerMtokMicros: 999_999,
      geminiOutputCostPerMtokMicros: 999_999,
    })

    expect(cost.transcriptionMicrosUsd).toBe(1)
    expect(cost.auditoryMicrosUsd).toBe(2)
    expect(cost.synthesisMicrosUsd).toBe(2)
    expect(cost.totalMicrosUsd).toBe(5)
    expect(Number.isInteger(cost.totalMicrosUsd)).toBe(true)
  })

  it('sums the output tokens already carrying the thoughts of both passes', () => {
    const cost = CostCalculator.calculateMultimodal({
      durationSeconds: 0,
      auditory: { inputTokens: 0, outputTokens: 7 },
      synthesis: { inputTokens: 0, outputTokens: 11 },
      transcriptionCostPerMinuteMicros: 0,
      geminiInputCostPerMtokMicros: 0,
      geminiOutputCostPerMtokMicros: 0,
    })

    expect(cost.outputTokens).toBe(18)
  })
})
