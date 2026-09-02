import { describe, expect, it } from 'vitest'

import { Analysis } from './index.js'

describe('Analysis', () => {
  it('stores immutable speech feedback without scores or versions', () => {
    const feedback = {
      summary: 'Clear message.',
      strengths: [{ title: 'Opening', evidence: 'Direct start.' }],
      improvements: [{ title: 'Close', evidence: 'Soft ending.', action: 'End firmly.' }],
    }
    const analysis = Analysis.create({
      analysisId: 'analysis-id',
      sessionId: 'session-id',
      feedback,
      processingMs: 1_000,
      costMicrosUsd: 500,
      createdAt: new Date('2026-09-01T12:00:00.000Z'),
    })

    expect(analysis.feedback).toEqual(feedback)
    expect(Object.isFrozen(analysis.feedback)).toBe(true)
  })
})
