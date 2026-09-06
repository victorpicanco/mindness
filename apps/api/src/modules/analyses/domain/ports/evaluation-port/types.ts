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
  readonly delivery?: DeliveryFeedback
}

export interface RhythmWindow {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly wordCount: number
  readonly wordsPerMinute: number
}

export interface RhythmMeasurements {
  readonly durationSeconds: number
  readonly wordCount: number
  readonly wordsPerMinute: number | null
  readonly windows: readonly RhythmWindow[]
}

export interface FillerOccurrence {
  readonly expression: string
  readonly startSeconds: number
  readonly endSeconds: number
  readonly quote: string
  readonly confidence: 'high' | 'medium'
}

export type FillerAssessmentStatus = 'assessed' | 'partial' | 'unavailable'

export interface FillerMeasurements {
  readonly status: FillerAssessmentStatus
  readonly total: number | null
  readonly perMinute: number | null
  readonly byExpression: readonly { readonly expression: string; readonly count: number }[]
  readonly occurrences: readonly FillerOccurrence[]
}

export interface SpeechMoment {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly kind: 'pace' | 'pause' | 'articulation' | 'structure' | 'repetition' | 'delivery'
  readonly quote: string
  readonly observation: string
  readonly impact: string
  readonly action: string
}

export interface PracticeExercise {
  readonly focus: string
  readonly exercise: string
  readonly successCriterion: string
}

export interface DeliveryFeedback {
  readonly version: 2
  readonly promptVersion: 'speech-feedback-v2'
  readonly model: string
  readonly audioQuality: 'usable' | 'limited' | 'unusable'
  readonly limitations: readonly string[]
  readonly metrics: RhythmMeasurements
  readonly fillers: FillerMeasurements
  readonly moments: readonly SpeechMoment[]
  readonly nextPractice: PracticeExercise | null
}

export interface EvaluationResult {
  readonly feedback: SpeechFeedback
  readonly inputTokens: number
  readonly outputTokens: number
}
