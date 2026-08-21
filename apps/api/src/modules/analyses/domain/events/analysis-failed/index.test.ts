import { describe, expect, it } from 'vitest'

import { AnalysisFailed } from './index.js'

describe('AnalysisFailed', () => {
  it('uses the closed event name, version, and frozen primitive payload', () => {
    const event = AnalysisFailed.create({
      eventId: 'event-id',
      occurredAt: new Date('2026-08-21T12:00:00.000Z'),
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
      reason: 'evaluation_failed',
    })

    expect(event.eventName).toBe('analysis_failed')
    expect(event.version).toBe(1)
    expect(event.payload).toEqual({
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
      reason: 'evaluation_failed',
    })
    expect(Object.isFrozen(event.payload)).toBe(true)
  })
})
