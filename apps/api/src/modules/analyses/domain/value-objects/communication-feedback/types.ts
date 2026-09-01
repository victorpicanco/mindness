export const AUDIO_USABILITIES = ['usable', 'limited', 'unusable'] as const
export const ALIGNMENT_QUALITIES = ['reliable', 'partial', 'unreliable'] as const
export const TIMING_BASES = ['asr', 'audio'] as const
export const MOMENT_VALENCES = ['positive', 'neutral', 'negative'] as const
export const FEEDBACK_CONFIDENCES = ['low', 'medium', 'high'] as const
export const MOMENT_CATEGORIES = [
  'filler',
  'prolongation',
  'repetition',
  'restart',
  'pause',
  'articulation',
  'delivery',
  'structure',
  'clarity',
] as const

export type AudioUsability = (typeof AUDIO_USABILITIES)[number]
export type AlignmentQuality = (typeof ALIGNMENT_QUALITIES)[number]
export type TimingBasis = (typeof TIMING_BASES)[number]
export type MomentValence = (typeof MOMENT_VALENCES)[number]
export type FeedbackConfidence = (typeof FEEDBACK_CONFIDENCES)[number]
export type MomentCategory = (typeof MOMENT_CATEGORIES)[number]

export interface StrengthPoint {
  readonly title: string
  readonly evidence: string
  readonly whyItHelped: string
}

export interface FeedbackMoment {
  readonly id: string
  readonly startSeconds: number
  readonly endSeconds: number
  readonly timingBasis: TimingBasis
  readonly excerpt: string
  readonly observation: string
  readonly impact: string
  readonly nextAttempt: string
  readonly clearerAlternative: string | null
  readonly categories: readonly MomentCategory[]
  readonly valence: MomentValence
  readonly confidence: FeedbackConfidence
}

export interface RecurringPattern {
  readonly title: string
  readonly description: string
  readonly evidenceMomentIds: readonly string[]
  readonly impact: string
  readonly exercise: string
}

export interface AsrDivergence {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly asrVersion: string
  readonly heardVersion: string
  readonly relevance: string
}

export interface ImprovementPriority {
  readonly title: string
  readonly behavior: string
  readonly evidenceMomentIds: readonly string[]
  readonly importance: string
  readonly action: string
  readonly exercise: string
}

export interface CreateCommunicationFeedbackParams {
  readonly durationSeconds: number
  readonly audioUsability: AudioUsability
  readonly alignmentQuality: AlignmentQuality
  readonly limitations: readonly string[]
  readonly literalTranscript: string
  readonly mainMessage: string
  readonly attemptedStructure: string
  readonly summary: string
  readonly strengths: readonly StrengthPoint[]
  readonly moments: readonly FeedbackMoment[]
  readonly patterns: readonly RecurringPattern[]
  readonly asrDivergences: readonly AsrDivergence[]
  readonly priorities: readonly ImprovementPriority[]
}

export type ReconstituteCommunicationFeedbackParams = CreateCommunicationFeedbackParams
