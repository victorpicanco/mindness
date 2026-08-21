import { describe, expect, it } from 'vitest'

import { InvalidRhythmMetricsError } from '@/modules/analyses/domain/errors/invalid-rhythm-metrics-error/index.js'

import { RhythmMetrics } from './index.js'

const validMetrics = {
  wordsPerMinute: 145,
  wordCount: 12,
  speechDurationSeconds: 5,
  pauseCount: 3,
  longPauseCount: 1,
  longestPauseSeconds: 2.5,
}

describe('RhythmMetrics', () => {
  it('keeps all calculated metrics immutable', () => {
    const metrics = RhythmMetrics.create(validMetrics)

    expect(metrics).toMatchObject(validMetrics)
  })

  it.each([
    'wordsPerMinute',
    'wordCount',
    'speechDurationSeconds',
    'pauseCount',
    'longPauseCount',
    'longestPauseSeconds',
  ] as const)('rejects a negative %s', (field) => {
    expect(() => RhythmMetrics.create({ ...validMetrics, [field]: -1 })).toThrow(
      InvalidRhythmMetricsError,
    )
  })

  it('rejects long pauses that do not belong to the pause count', () => {
    expect(() =>
      RhythmMetrics.create({ ...validMetrics, pauseCount: 1, longPauseCount: 2 }),
    ).toThrow(InvalidRhythmMetricsError)
  })

  it('compares every metric', () => {
    expect(RhythmMetrics.create(validMetrics).equals(RhythmMetrics.create(validMetrics))).toBe(true)
    expect(
      RhythmMetrics.create(validMetrics).equals(
        RhythmMetrics.create({ ...validMetrics, pauseCount: validMetrics.pauseCount + 1 }),
      ),
    ).toBe(false)
  })
})
