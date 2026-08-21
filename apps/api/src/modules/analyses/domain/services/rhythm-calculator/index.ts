import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import type { RhythmCalculationResult, TranscriptionWords } from './types.js'

// D-08 defines pauses longer than 0.35 seconds as relevant rhythm pauses.
const PAUSE_THRESHOLD_SECONDS = 0.35
// D-08 defines long pauses as gaps longer than two seconds.
const LONG_PAUSE_THRESHOLD_SECONDS = 2

export class RhythmCalculator {
  static calculate(words: TranscriptionWords): RhythmCalculationResult {
    const [firstWord, ...followingWords] = words
    const lastWord = followingWords.at(-1) ?? firstWord
    const speechDurationSeconds = lastWord.end - firstWord.start
    const wordsPerMinute = Math.round((words.length / speechDurationSeconds) * 60)

    let pauseCount = 0
    let longPauseCount = 0
    let longestPauseSeconds = 0

    let previousWord = firstWord

    for (const currentWord of followingWords) {
      const pauseSeconds = currentWord.start - previousWord.end

      if (pauseSeconds > PAUSE_THRESHOLD_SECONDS) {
        pauseCount += 1
      }

      if (pauseSeconds > LONG_PAUSE_THRESHOLD_SECONDS) {
        longPauseCount += 1
      }

      if (pauseSeconds > longestPauseSeconds) {
        longestPauseSeconds = pauseSeconds
      }

      previousWord = currentWord
    }

    return {
      metrics: RhythmMetrics.create({
        wordsPerMinute,
        wordCount: words.length,
        speechDurationSeconds,
        pauseCount,
        longPauseCount,
        longestPauseSeconds,
      }),
    }
  }
}
