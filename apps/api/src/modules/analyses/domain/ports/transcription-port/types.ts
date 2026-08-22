import type { TranscriptionWord } from '@/modules/analyses/domain/entities/transcription/index.js'

export interface TranscriptionResult {
  readonly text: string
  readonly words: readonly TranscriptionWord[]
  readonly averageConfidence: number
  readonly durationSeconds: number
}
