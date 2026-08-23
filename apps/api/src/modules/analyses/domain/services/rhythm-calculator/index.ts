import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import type { RhythmCalculationResult, TranscriptionWords } from './types.js'

const PAUSE_THRESHOLD_SECONDS = 0.35
const LONG_PAUSE_THRESHOLD_SECONDS = 2
const IDEAL_MINIMUM_WORDS_PER_MINUTE = 130
const IDEAL_MAXIMUM_WORDS_PER_MINUTE = 160
const LONG_PAUSE_PENALTY = 3
const MAXIMUM_PAUSE_PENALTY = 30
const TOO_MANY_LONG_PAUSES_GUIDANCE =
  'Suas pausas longas quebraram o fio da apresentação. Prepare a próxima frase enquanto termina a anterior e use pausas curtas para respirar.'
const TOO_FAST_GUIDANCE =
  'Você falou acima do ritmo confortável de escuta. Marque as pausas no fim de cada frase e resista à vontade de emendar uma ideia na outra.'
const TOO_SLOW_GUIDANCE =
  'Seu ritmo ficou abaixo do confortável de escuta. Encadeie as frases com mais firmeza e evite alongar as sílabas finais.'
const ON_TARGET_GUIDANCE =
  'Seu ritmo ficou na faixa confortável de escuta e as pausas sustentaram o encadeamento das ideias.'

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

    const metrics = RhythmMetrics.create({
      wordsPerMinute,
      wordCount: words.length,
      speechDurationSeconds,
      pauseCount,
      longPauseCount,
      longestPauseSeconds,
    })

    return { metrics, score: calculateScore(metrics), guidance: selectGuidance(metrics) }
  }
}

function calculateScore(metrics: RhythmMetrics): number {
  const wpmScore = calculateWordsPerMinuteScore(metrics.wordsPerMinute)
  const pausePenalty = Math.min(LONG_PAUSE_PENALTY * metrics.longPauseCount, MAXIMUM_PAUSE_PENALTY)

  return Math.max(wpmScore - pausePenalty, 0)
}

function calculateWordsPerMinuteScore(wordsPerMinute: number): number {
  if (wordsPerMinute < IDEAL_MINIMUM_WORDS_PER_MINUTE) {
    return Math.max(100 - 2 * (IDEAL_MINIMUM_WORDS_PER_MINUTE - wordsPerMinute), 0)
  }

  if (wordsPerMinute > IDEAL_MAXIMUM_WORDS_PER_MINUTE) {
    return Math.max(100 - 2 * (wordsPerMinute - IDEAL_MAXIMUM_WORDS_PER_MINUTE), 0)
  }

  return 100
}

function selectGuidance(metrics: RhythmMetrics): string {
  if (metrics.longPauseCount >= 3) {
    return TOO_MANY_LONG_PAUSES_GUIDANCE
  }

  if (metrics.wordsPerMinute > IDEAL_MAXIMUM_WORDS_PER_MINUTE) {
    return TOO_FAST_GUIDANCE
  }

  if (metrics.wordsPerMinute < IDEAL_MINIMUM_WORDS_PER_MINUTE) {
    return TOO_SLOW_GUIDANCE
  }

  return ON_TARGET_GUIDANCE
}
