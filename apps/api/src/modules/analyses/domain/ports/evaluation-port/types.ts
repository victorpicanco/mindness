export interface EvaluationResult {
  readonly clarityScore: number
  readonly clarityGuidance: string
  readonly fluencyScore: number
  readonly fluencyGuidance: string
  readonly masteryScore: number
  readonly masteryGuidance: string
  readonly inputTokens: number
  readonly outputTokens: number
}
