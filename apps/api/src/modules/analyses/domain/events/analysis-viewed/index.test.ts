import { describe, expect, it } from 'vitest'

import { AnalysisViewed } from './index.js'

describe('AnalysisViewed', () => {
  it('uses the closed event name, preserves its identity and freezes scores and payload', () => {
    const occurredAt = new Date('2026-08-22T12:00:00.000Z')
    const event = AnalysisViewed.create({
      eventId: 'event-id',
      occurredAt,
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
      scores: { clarity: 80, rhythm: 81, fluency: 82, mastery: 83, total: 82 },
    })

    expect(event.eventName).toBe('analysis_viewed')
    expect(event.version).toBe(1)
    expect(event.eventId).toBe('event-id')
    expect(event.occurredAt).toEqual(occurredAt)
    expect(event.payload).toEqual({
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
      scores: { clarity: 80, rhythm: 81, fluency: 82, mastery: 83, total: 82 },
    })
    expect(Object.isFrozen(event.payload.scores)).toBe(true)
    expect(Object.isFrozen(event.payload)).toBe(true)
  })
})
