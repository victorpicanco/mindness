import { describe, expect, it } from 'vitest'

import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'

import { AnalysisMapper } from './index.js'

const feedback = {
  summary: 'Clear.',
  strengths: [{ title: 'Opening', evidence: 'Direct.' }],
  improvements: [{ title: 'Close', evidence: 'Soft.', action: 'End firmly.' }],
}

describe('AnalysisMapper', () => {
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
