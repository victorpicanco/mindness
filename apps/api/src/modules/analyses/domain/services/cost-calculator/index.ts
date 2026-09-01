import type {
  CalculateMultimodalProcessingCostInput,
  CalculateProcessingCostInput,
  GeminiPassUsage,
  MultimodalProcessingCost,
  ProcessingCost,
} from './types.js'

const SECONDS_PER_MINUTE = 60
const TOKENS_PER_MILLION = 1_000_000

interface GeminiRates {
  readonly geminiInputCostPerMtokMicros: number
  readonly geminiOutputCostPerMtokMicros: number
}

export class CostCalculator {
  static calculate(input: CalculateProcessingCostInput): ProcessingCost {
    const transcriptionMicrosUsd = transcriptionCost(input)
    const evaluationMicrosUsd = geminiPassCost(input, input)

    return {
      transcriptionMicrosUsd,
      evaluationMicrosUsd,
      totalMicrosUsd: transcriptionMicrosUsd + evaluationMicrosUsd,
      outputTokens: input.outputTokens,
    }
  }

  static calculateMultimodal(
    input: CalculateMultimodalProcessingCostInput,
  ): MultimodalProcessingCost {
    const transcriptionMicrosUsd = transcriptionCost(input)
    const auditoryMicrosUsd = geminiPassCost(input.auditory, input)
    const synthesisMicrosUsd = geminiPassCost(input.synthesis, input)
    const evaluationMicrosUsd = auditoryMicrosUsd + synthesisMicrosUsd

    return {
      transcriptionMicrosUsd,
      auditoryMicrosUsd,
      synthesisMicrosUsd,
      evaluationMicrosUsd,
      totalMicrosUsd: transcriptionMicrosUsd + evaluationMicrosUsd,
      outputTokens: input.auditory.outputTokens + input.synthesis.outputTokens,
    }
  }
}

function transcriptionCost(input: {
  readonly durationSeconds: number
  readonly transcriptionCostPerMinuteMicros: number
}): number {
  return Math.ceil(
    (input.durationSeconds * input.transcriptionCostPerMinuteMicros) / SECONDS_PER_MINUTE,
  )
}

function geminiPassCost(usage: GeminiPassUsage, rates: GeminiRates): number {
  return (
    Math.ceil((usage.inputTokens * rates.geminiInputCostPerMtokMicros) / TOKENS_PER_MILLION) +
    Math.ceil((usage.outputTokens * rates.geminiOutputCostPerMtokMicros) / TOKENS_PER_MILLION)
  )
}

export type {
  CalculateMultimodalProcessingCostInput,
  CalculateProcessingCostInput,
  GeminiPassUsage,
  MultimodalProcessingCost,
  ProcessingCost,
} from './types.js'
