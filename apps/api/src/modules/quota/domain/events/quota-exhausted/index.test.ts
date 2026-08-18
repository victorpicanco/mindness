import { describe, expect, it } from 'vitest'

import { QuotaExhausted } from './index.js'

describe('QuotaExhausted', () => {
  it('carries the canonical integration event envelope', () => {
    const event = QuotaExhausted.create({
      eventId: 'event-1',
      occurredAt: new Date('2026-08-17T00:00:00.000Z'),
      accountId: 'account-1',
      plan: 'free',
      renewsAt: new Date('2026-09-16T00:00:00.000Z'),
    })

    expect(event.eventName).toBe('quota_exhausted')
    expect(event.version).toBe(1)
    expect(event.eventId).toBe('event-1')
  })

  it('does not retain or expose a mutable occurrence instant', () => {
    const occurredAt = new Date('2026-08-17T00:00:00.000Z')
    const event = QuotaExhausted.create({
      eventId: 'event-1',
      occurredAt,
      accountId: 'account-1',
      plan: 'free',
      renewsAt: new Date('2026-09-16T00:00:00.000Z'),
    })
    occurredAt.setTime(0)
    const exposed = event.occurredAt
    exposed.setTime(0)

    expect(event.occurredAt).toEqual(new Date('2026-08-17T00:00:00.000Z'))
  })

  it('carries only serializable primitives in its payload', () => {
    const event = QuotaExhausted.create({
      eventId: 'event-1',
      occurredAt: new Date('2026-08-17T00:00:00.000Z'),
      accountId: 'account-1',
      plan: 'free',
      renewsAt: new Date('2026-09-16T00:00:00.000Z'),
    })

    expect(event.payload).toEqual({
      accountId: 'account-1',
      plan: 'free',
      renewsAt: '2026-09-16T00:00:00.000Z',
    })
    expect(JSON.parse(JSON.stringify(event.payload))).toEqual(event.payload)
  })
})
