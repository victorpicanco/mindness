import { describe, expect, it } from 'vitest'

import { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'
import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import { Analysis } from './index.js'

describe('Analysis', () => {
  it('calculates the rounded total score from its four pillars', () => {
    const analysis = createAnalysis([80, 90, 70, 61])

    expect(analysis.totalScore).toBe(75)
  })

  it('rounds a half total score up', () => {
    const analysis = createAnalysis([80, 80, 81, 81])

    expect(analysis.totalScore).toBe(81)
  })

  it.each([
    { scores: [0, 0, 0, 0] as const },
    { scores: [100, 100, 100, 100] as const },
    { scores: [0, 100, 0, 100] as const },
  ])('keeps the calculated total as an integer inside the score range', ({ scores }) => {
    const analysis = createAnalysis(scores)

    expect(Number.isInteger(analysis.totalScore)).toBe(true)
    expect(analysis.totalScore).toBeGreaterThanOrEqual(0)
    expect(analysis.totalScore).toBeLessThanOrEqual(100)
  })
})

function createAnalysis(scores: readonly [number, number, number, number]): Analysis {
  return Analysis.create({
    analysisId: 'analysis-id',
    sessionId: 'session-id',
    clarityScore: PillarScore.create(scores[0]),
    rhythmScore: PillarScore.create(scores[1]),
    fluencyScore: PillarScore.create(scores[2]),
    masteryScore: PillarScore.create(scores[3]),
    clarityGuidance: 'Clarity guidance',
    rhythmGuidance: 'Rhythm guidance',
    fluencyGuidance: 'Fluency guidance',
    masteryGuidance: 'Mastery guidance',
    rhythmMetrics: RhythmMetrics.create({
      wordsPerMinute: 140,
      wordCount: 20,
      speechDurationSeconds: 10,
      pauseCount: 0,
      longPauseCount: 0,
      longestPauseSeconds: 0,
    }),
    processingMs: 200,
    costMicrosUsd: 300,
    createdAt: new Date('2026-08-21T12:00:00.000Z'),
  })
}
