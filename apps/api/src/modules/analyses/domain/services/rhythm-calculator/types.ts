export interface TranscriptionWord {
  readonly word: string
  readonly start: number
  readonly end: number
}

export type TranscriptionWords = readonly [TranscriptionWord, ...TranscriptionWord[]]

export interface RhythmCalculationResult {
  readonly metrics: RhythmMetrics
}
import type { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'
