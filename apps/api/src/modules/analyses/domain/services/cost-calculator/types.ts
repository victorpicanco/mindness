export interface CalculateProcessingCostInput {
  readonly durationSeconds: number
  readonly inputTokens: number
  readonly outputTokens: number
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

export interface GeminiPassUsage {
  readonly inputTokens: number
  readonly outputTokens: number
}

export interface CalculateMultimodalProcessingCostInput {
  readonly durationSeconds: number
  readonly auditory: GeminiPassUsage
  readonly synthesis: GeminiPassUsage
  readonly transcriptionCostPerMinuteMicros: number
  readonly geminiInputCostPerMtokMicros: number
  readonly geminiOutputCostPerMtokMicros: number
}

export interface MultimodalProcessingCost extends ProcessingCost {
  readonly auditoryMicrosUsd: number
  readonly synthesisMicrosUsd: number
}
