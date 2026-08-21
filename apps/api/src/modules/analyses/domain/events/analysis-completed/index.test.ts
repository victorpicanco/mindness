import { describe, expect, it } from 'vitest'

import { AnalysisCompleted } from './index.js'

describe('AnalysisCompleted', () => {
  it('uses the closed event name, version, and frozen primitive payload', () => {
    const event = AnalysisCompleted.create({
      eventId: 'event-id',
      occurredAt: new Date('2026-08-21T12:00:00.000Z'),
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
      scores: { clarity: 80, rhythm: 81, fluency: 82, mastery: 83, total: 82 },
      processingMs: 300,
      costMicrosUsd: 400,
    })

    expect(event.eventName).toBe('analysis_completed')
    expect(event.version).toBe(1)
    expect(event.payload).toEqual({
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
      scores: { clarity: 80, rhythm: 81, fluency: 82, mastery: 83, total: 82 },
      processingMs: 300,
      costMicrosUsd: 400,
    })
    expect(Object.isFrozen(event.payload)).toBe(true)
  })
})
