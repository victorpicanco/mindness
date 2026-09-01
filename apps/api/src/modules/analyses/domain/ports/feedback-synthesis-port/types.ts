import type { TranscriptionWord } from '@/modules/analyses/domain/entities/transcription/index.js'
import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { AuditoryObservation } from '@/modules/analyses/domain/ports/auditory-analysis-port/index.js'
import type { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'
import type { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

export interface FeedbackSynthesisInput {
  readonly audio: PreparedAudio
  readonly observation: AuditoryObservation
  readonly themeTitle: string
  readonly transcript: string
  readonly words: readonly TranscriptionWord[]
  readonly rhythm: RhythmMetrics
  readonly signal: AbortSignal
}

export interface FeedbackSynthesisResult {
  readonly feedback: CommunicationFeedback
  readonly inputTokens: number
  readonly outputTokens: number
}
