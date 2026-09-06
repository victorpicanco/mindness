import type { PreparedAudio } from '@/modules/analyses/domain/ports/audio-preparation-port/index.js'
import type { TranscriptionWord } from '@/modules/analyses/domain/entities/transcription/index.js'

import type { EvaluationResult } from './types.js'

export interface EvaluationPort {
  evaluate(input: {
    readonly audio: PreparedAudio
    readonly themeTitle: string
    readonly transcript: string
    readonly words: readonly TranscriptionWord[]
    readonly signal: AbortSignal
  }): Promise<EvaluationResult>
}

export type { EvaluationResult, FeedbackPoint, ImprovementPoint, SpeechFeedback } from './types.js'
export type {
  DeliveryFeedback,
  FillerOccurrence,
  FillerAssessmentStatus,
  FillerMeasurements,
  RhythmMeasurements,
  RhythmWindow,
  SpeechMoment,
  PracticeExercise,
} from './types.js'
