import { InvalidRhythmMetricsError } from '@/modules/analyses/domain/errors/invalid-rhythm-metrics-error/index.js'

export interface CreateRhythmMetricsParams {
  readonly wordsPerMinute: number
  readonly wordCount: number
  readonly speechDurationSeconds: number
  readonly pauseCount: number
  readonly longPauseCount: number
  readonly longestPauseSeconds: number
}

export class RhythmMetrics {
  private constructor(
    readonly wordsPerMinute: number,
    readonly wordCount: number,
    readonly speechDurationSeconds: number,
    readonly pauseCount: number,
    readonly longPauseCount: number,
    readonly longestPauseSeconds: number,
  ) {}

  static create(params: CreateRhythmMetricsParams): RhythmMetrics {
    for (const [field, value] of Object.entries(params)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new InvalidRhythmMetricsError(field)
      }
    }

    if (params.longPauseCount > params.pauseCount) {
      throw new InvalidRhythmMetricsError('longPauseCount')
    }

    return new RhythmMetrics(
      params.wordsPerMinute,
      params.wordCount,
      params.speechDurationSeconds,
      params.pauseCount,
      params.longPauseCount,
      params.longestPauseSeconds,
    )
  }

  equals(other: RhythmMetrics): boolean {
    return (
      this.wordsPerMinute === other.wordsPerMinute &&
      this.wordCount === other.wordCount &&
      this.speechDurationSeconds === other.speechDurationSeconds &&
      this.pauseCount === other.pauseCount &&
      this.longPauseCount === other.longPauseCount &&
      this.longestPauseSeconds === other.longestPauseSeconds
    )
  }
}
