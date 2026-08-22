import { describe, expect, it } from 'vitest'

import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'

import { AnalysisMapper } from './index.js'

const row = {
  id: 'analysis-id',
  sessionId: 'session-id',
  clarityScore: 80,
  rhythmScore: 70,
  fluencyScore: 60,
  masteryScore: 90,
  totalScore: 75,
  guidance: {
    clarity: 'Be clearer',
    rhythm: 'Keep pace',
    fluency: 'Speak smoothly',
    mastery: 'Know the subject',
  },
  rhythmMetrics: {
    wordsPerMinute: 140,
    wordCount: 20,
    speechDurationSeconds: 8,
    pauseCount: 2,
    longPauseCount: 1,
    longestPauseSeconds: 2.5,
  },
  processingMs: 1234,
  costMicrosUsd: 42,
  createdAt: new Date('2026-08-21T12:00:00.000Z'),
}

describe('AnalysisMapper', () => {
  it('maps persisted JSON guidance and rhythm metrics to and from the domain without loss', () => {
    const mapper = new AnalysisMapper()
    const analysis = mapper.toDomain(row)

    expect(analysis).toBeInstanceOf(Analysis)
    expect(mapper.toData(analysis)).toEqual(row)
  })
})
