import { describe, expect, it } from 'vitest'

import { RhythmCalculator } from './index.js'
import type { TranscriptionWord, TranscriptionWords } from './types.js'

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

  it.each([
    { wordsPerMinute: 145, longPauseCount: 0, expectedScore: 100 },
    { wordsPerMinute: 120, longPauseCount: 0, expectedScore: 80 },
    { wordsPerMinute: 180, longPauseCount: 0, expectedScore: 60 },
    { wordsPerMinute: 145, longPauseCount: 4, expectedScore: 88 },
  ])(
    'derives score $expectedScore for $wordsPerMinute WPM and $longPauseCount long pauses',
    ({ wordsPerMinute, longPauseCount, expectedScore }) => {
      expect(RhythmCalculator.calculate(wordsAt(wordsPerMinute, longPauseCount)).score).toBe(
        expectedScore,
      )
    },
  )

  it.each([
    { wordsPerMinute: 1, longPauseCount: 10 },
    { wordsPerMinute: 500, longPauseCount: 0 },
  ])('keeps the score within the allowed range', ({ wordsPerMinute, longPauseCount }) => {
    const score = RhythmCalculator.calculate(wordsAt(wordsPerMinute, longPauseCount)).score

    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it.each([
    {
      wordsPerMinute: 200,
      longPauseCount: 3,
      guidance:
        'Suas pausas longas quebraram o fio da apresentação. Prepare a próxima frase enquanto termina a anterior e use pausas curtas para respirar.',
    },
    {
      wordsPerMinute: 200,
      longPauseCount: 1,
      guidance:
        'Você falou acima do ritmo confortável de escuta. Marque as pausas no fim de cada frase e resista à vontade de emendar uma ideia na outra.',
    },
    {
      wordsPerMinute: 100,
      longPauseCount: 0,
      guidance:
        'Seu ritmo ficou abaixo do confortável de escuta. Encadeie as frases com mais firmeza e evite alongar as sílabas finais.',
    },
    {
      wordsPerMinute: 145,
      longPauseCount: 2,
      guidance:
        'Seu ritmo ficou na faixa confortável de escuta e as pausas sustentaram o encadeamento das ideias.',
    },
  ])(
    'uses the guidance precedence for $wordsPerMinute WPM and $longPauseCount long pauses',
    ({ wordsPerMinute, longPauseCount, guidance }) => {
      expect(RhythmCalculator.calculate(wordsAt(wordsPerMinute, longPauseCount)).guidance).toBe(
        guidance,
      )
    },
  )
})

function word(wordValue: string, start: number, end: number): TranscriptionWord {
  return { word: wordValue, start, end }
}

function wordsAt(wordsPerMinute: number, longPauseCount: number): TranscriptionWords {
  const wordDurationSeconds = 0.1
  const longPauseSeconds = 2.1
  const normalPauseCount = wordsPerMinute - 1 - longPauseCount
  const normalPauseSeconds =
    (60 - wordsPerMinute * wordDurationSeconds - longPauseCount * longPauseSeconds) /
    normalPauseCount
  const firstWord = word('word-0', 0, wordDurationSeconds)
  const followingWords: TranscriptionWord[] = []
  let previousEnd = firstWord.end

  for (let index = 1; index < wordsPerMinute; index += 1) {
    const pauseSeconds = index <= longPauseCount ? longPauseSeconds : normalPauseSeconds
    const start = previousEnd + pauseSeconds
    const currentWord = word(`word-${index}`, start, start + wordDurationSeconds)

    followingWords.push(currentWord)
    previousEnd = currentWord.end
  }

  return [firstWord, ...followingWords]
}
