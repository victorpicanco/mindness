import { describe, expect, it } from 'vitest'

import { AnalysisTimedOut } from './index.js'

describe('AnalysisTimedOut', () => {
  it('uses analysis_timeout as the closed event name with a frozen primitive payload', () => {
    const event = AnalysisTimedOut.create({
      eventId: 'event-id',
      occurredAt: new Date('2026-08-21T12:00:00.000Z'),
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
    })

    expect(event.eventName).toBe('analysis_timeout')
    expect(event.version).toBe(1)
    expect(event.payload).toEqual({
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
    })
    expect(Object.isFrozen(event.payload)).toBe(true)
  })
})
