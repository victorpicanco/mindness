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
      authenticationMethod: 'password',
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
      authenticationMethod: 'password',
    })

    expect(event.payload).toEqual({
      accountId: 'account-1',
      plan: 'free',
      origin: 'api',
      authenticationMethod: 'password',
    })
    expect(JSON.parse(JSON.stringify(event.payload))).toEqual(event.payload)
  })

  it('does not retain or expose a mutable occurrence instant', () => {
    const input = new Date('2026-08-15T00:00:00.000Z')
    const event = AccountCreated.create({
      eventId: 'event-1',
      occurredAt: input,
      accountId: 'account-1',
      plan: 'free',
      authenticationMethod: 'password',
    })
    input.setTime(0)
    const exposed = event.occurredAt
    exposed.setTime(0)

    expect(event.occurredAt).toEqual(new Date('2026-08-15T00:00:00.000Z'))
  })
})
