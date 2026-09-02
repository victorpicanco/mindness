import { describe, expect, it } from 'vitest'

import { AnalysisCompleted } from './index.js'

describe('AnalysisCompleted', () => {
  it('publishes one unversioned product payload without scores', () => {
    const event = AnalysisCompleted.create({
      eventId: 'event-id',
      occurredAt: new Date('2026-09-01T12:00:00.000Z'),
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
      processingMs: 100,
      costMicrosUsd: 20,
    })

    expect(event.payload).toEqual({
      sessionId: 'session-id',
      accountId: 'account-id',
      plan: 'free',
      processingMs: 100,
      costMicrosUsd: 20,
    })
    expect(event.payload).not.toHaveProperty('scores')
  })
})
