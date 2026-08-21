import { describe, expect, it } from 'vitest'

import { RhythmCalculator } from './index.js'
import type { TranscriptionWord } from './types.js'

describe('RhythmCalculator', () => {
  it('calculates and rounds words per minute from the speech duration', () => {
    const result = RhythmCalculator.calculate([
      word('one', 0, 0.5),
      word('two', 20, 20.5),
      word('three', 40, 40.5),
    ])

    expect(result.metrics.wordsPerMinute).toBe(4)
    expect(result.metrics.wordCount).toBe(3)
    expect(result.metrics.speechDurationSeconds).toBe(40.5)
  })

  it('counts pauses above 0.35 seconds but not intervals below it', () => {
    const result = RhythmCalculator.calculate([
      word('one', 0, 0.5),
      word('two', 0.9, 1.2),
      word('three', 1.5, 2),
    ])

    expect(result.metrics.pauseCount).toBe(1)
  })

  it('counts long pauses as a subset of all pauses', () => {
    const result = RhythmCalculator.calculate([word('one', 0, 0.5), word('two', 3, 3.5)])

    expect(result.metrics.pauseCount).toBe(1)
    expect(result.metrics.longPauseCount).toBe(1)
  })

  it('keeps the largest interval as the longest pause', () => {
    const result = RhythmCalculator.calculate([
      word('one', 0, 0.5),
      word('two', 1, 1.5),
      word('three', 4, 4.5),
      word('four', 5, 5.5),
    ])

    expect(result.metrics.longestPauseSeconds).toBe(2.5)
  })

  it('uses zero pause metrics for one word', () => {
    const result = RhythmCalculator.calculate([word('one', 0, 60)])

    expect(result.metrics.pauseCount).toBe(0)
    expect(result.metrics.longPauseCount).toBe(0)
    expect(result.metrics.longestPauseSeconds).toBe(0)
  })
})

function word(wordValue: string, start: number, end: number): TranscriptionWord {
  return { word: wordValue, start, end }
}
