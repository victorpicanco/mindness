import type { CalculateProcessingCostInput, ProcessingCost } from './types.js'

const SECONDS_PER_MINUTE = 60
const TOKENS_PER_MILLION = 1_000_000

export class CostCalculator {
  static calculate(input: CalculateProcessingCostInput): ProcessingCost {
    const transcriptionMicrosUsd = Math.ceil(
      (input.durationSeconds * input.transcriptionCostPerMinuteMicros) / SECONDS_PER_MINUTE,
    )
    const evaluationMicrosUsd =
      Math.ceil((input.inputTokens * input.geminiInputCostPerMtokMicros) / TOKENS_PER_MILLION) +
      Math.ceil((input.outputTokens * input.geminiOutputCostPerMtokMicros) / TOKENS_PER_MILLION)

    return {
      transcriptionMicrosUsd,
      evaluationMicrosUsd,
      totalMicrosUsd: transcriptionMicrosUsd + evaluationMicrosUsd,
      outputTokens: input.outputTokens,
    }
  }
}

export type { CalculateProcessingCostInput, ProcessingCost } from './types.js'
