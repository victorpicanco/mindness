import type { TranscriptionWord } from '@/modules/analyses/domain/entities/transcription/index.js'
import type {
  FillerAssessmentStatus,
  FillerMeasurements,
  FillerOccurrence,
  RhythmMeasurements,
  RhythmWindow,
} from '@/modules/analyses/domain/ports/evaluation-port/index.js'

const WINDOW_SECONDS = 10
const SECONDS_PER_MINUTE = 60

export class SpeechMeasurements {
  static rhythm(words: readonly TranscriptionWord[], durationSeconds: number): RhythmMeasurements {
    if (words.length === 0)
      return { durationSeconds, wordCount: 0, wordsPerMinute: null, windows: [] }

    const windows: RhythmWindow[] = []
    for (let startSeconds = 0; startSeconds < durationSeconds; startSeconds += WINDOW_SECONDS) {
      const endSeconds = Math.min(startSeconds + WINDOW_SECONDS, durationSeconds)
      const wordCount = words.filter(
        (word) => word.start >= startSeconds && word.start < endSeconds,
      ).length
      windows.push({
        startSeconds,
        endSeconds,
        wordCount,
        wordsPerMinute: Math.round((wordCount * SECONDS_PER_MINUTE) / (endSeconds - startSeconds)),
      })
    }
    return {
      durationSeconds,
      wordCount: words.length,
      wordsPerMinute: Math.round((words.length * SECONDS_PER_MINUTE) / durationSeconds),
      windows,
    }
  }

  static fillers(
    status: FillerAssessmentStatus,
    occurrences: readonly FillerOccurrence[],
    durationSeconds: number,
  ): FillerMeasurements {
    const counts = new Map<string, number>()
    for (const occurrence of occurrences) {
      const expression = occurrence.expression.normalize('NFC').trim().toLocaleLowerCase('pt-BR')
      counts.set(expression, (counts.get(expression) ?? 0) + 1)
    }
    return {
      status,
      total: status === 'unavailable' ? null : occurrences.length,
      perMinute:
        status === 'unavailable'
          ? null
          : Math.round(((occurrences.length * SECONDS_PER_MINUTE) / durationSeconds) * 10) / 10,
      byExpression: Array.from(counts, ([expression, count]) => ({ expression, count })).sort(
        (left, right) =>
          right.count - left.count || left.expression.localeCompare(right.expression, 'pt-BR'),
      ),
      occurrences,
    }
  }
}
