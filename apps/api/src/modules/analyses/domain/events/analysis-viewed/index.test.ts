import { describe, expect, it } from 'vitest'

import { AnalysisViewed } from './index.js'

describe('AnalysisViewed', () => {
  it('does not leak feedback or scores', () => {
    const event = AnalysisViewed.create({
      eventId: 'event-id',
      occurredAt: new Date('2026-09-01T12:00:00.000Z'),
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
    })

    expect(event.payload).toEqual({
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
    })
  })
})
