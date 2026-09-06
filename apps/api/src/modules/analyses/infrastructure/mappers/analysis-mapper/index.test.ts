import { describe, expect, it } from 'vitest'

import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'

import { AnalysisMapper } from './index.js'
import { createDetailedFeedback } from '@/modules/analyses/infrastructure/adapters/gemini-evaluation-adapter/fixtures.js'
import { parseEvaluationFeedback } from '@/modules/analyses/infrastructure/adapters/gemini-evaluation-adapter/schemas.js'

const feedback = {
  summary: 'Clear.',
  strengths: [{ title: 'Opening', evidence: 'Direct.' }],
  improvements: [{ title: 'Close', evidence: 'Soft.', action: 'End firmly.' }],
}

describe('AnalysisMapper', () => {
  it('preserves and deeply freezes evidence and measurements through persistence', () => {
    const detailed = parseEvaluationFeedback(
      createDetailedFeedback(),
      { durationSeconds: 30, wordCount: 0, wordsPerMinute: null, windows: [] },
      'test-model',
    )
    const mapper = new AnalysisMapper()
    const analysis = Analysis.create({
      analysisId: 'analysis-id',
      sessionId: 'session-id',
      feedback: detailed,
      processingMs: 100,
      costMicrosUsd: 20,
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
    })

    expect(mapper.toDomain(mapper.toData(analysis)).feedback).toEqual(detailed)
    expect(analysis.feedback.delivery).toBeDefined()
    expect(Object.isFrozen(analysis.feedback.delivery?.fillers.occurrences)).toBe(true)
    expect(Object.isFrozen(analysis.feedback.delivery?.fillers.occurrences[0])).toBe(true)
    expect(Object.isFrozen(analysis.feedback.delivery?.moments[0])).toBe(true)
    expect(Object.isFrozen(analysis.feedback.delivery?.nextPractice)).toBe(true)
  })
  it('round-trips the feedback JSON', () => {
    const mapper = new AnalysisMapper()
    const analysis = Analysis.create({
      analysisId: 'analysis-id',
      sessionId: 'session-id',
      feedback,
      processingMs: 100,
      costMicrosUsd: 20,
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
    })

    expect(mapper.toDomain(mapper.toData(analysis)).feedback).toEqual(feedback)
  })
})
