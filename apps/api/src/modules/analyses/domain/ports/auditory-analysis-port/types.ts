import type {
  AudioUsability,
  FeedbackConfidence,
  MomentCategory,
} from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'

export interface AuditoryCandidateEvent {
  readonly startSeconds: number
  readonly endSeconds: number
  readonly excerpt: string
  readonly category: MomentCategory
  readonly auditoryEvidence: string
  readonly confidence: FeedbackConfidence
}

export interface AuditoryObservation {
  readonly audioUsability: AudioUsability
  readonly limitations: readonly string[]
  readonly literalTranscript: string
  readonly mainMessage: string
  readonly attemptedStructure: string
  readonly deliverySummary: string
  readonly candidateEvents: readonly AuditoryCandidateEvent[]
}

export interface AuditoryAnalysisResult {
  readonly observation: AuditoryObservation
  readonly inputTokens: number
  readonly outputTokens: number
}
