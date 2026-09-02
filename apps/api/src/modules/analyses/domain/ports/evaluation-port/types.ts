export interface FeedbackPoint {
  readonly title: string
  readonly evidence: string
}

export interface ImprovementPoint extends FeedbackPoint {
  readonly action: string
}

export interface SpeechFeedback {
  readonly summary: string
  readonly strengths: readonly FeedbackPoint[]
  readonly improvements: readonly ImprovementPoint[]
}

export interface EvaluationResult {
  readonly feedback: SpeechFeedback
  readonly inputTokens: number
  readonly outputTokens: number
}
