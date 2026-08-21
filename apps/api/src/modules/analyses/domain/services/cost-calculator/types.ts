export interface CalculateProcessingCostInput {
  readonly durationSeconds: number
  readonly inputTokens: number
  readonly candidatesTokenCount: number
  readonly thoughtsTokenCount: number
  readonly transcriptionCostPerMinuteMicros: number
  readonly geminiInputCostPerMtokMicros: number
  readonly geminiOutputCostPerMtokMicros: number
}

export interface ProcessingCost {
  readonly transcriptionMicrosUsd: number
  readonly evaluationMicrosUsd: number
  readonly totalMicrosUsd: number
  readonly outputTokens: number
}
