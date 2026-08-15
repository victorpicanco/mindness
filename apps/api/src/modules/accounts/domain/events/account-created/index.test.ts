import { describe, expect, it } from 'vitest'

import { AccountCreated } from './index.js'

const occurredAt = new Date('2026-08-15T00:00:00.000Z')

describe('AccountCreated', () => {
  it('carries the canonical integration event envelope', () => {
    const event = AccountCreated.create({
      eventId: 'event-1',
      occurredAt,
      accountId: 'account-1',
      plan: 'free',
    })

    expect(event).toMatchObject({
      eventId: 'event-1',
      eventName: 'account_created',
      version: 1,
      occurredAt,
    })
  })

  it('carries only serializable primitives in its payload', () => {
    const event = AccountCreated.create({
      eventId: 'event-1',
      occurredAt,
      accountId: 'account-1',
      plan: 'free',
    })

    expect(event.payload).toEqual({ accountId: 'account-1', plan: 'free' })
    expect(JSON.parse(JSON.stringify(event.payload))).toEqual(event.payload)
  })
})
