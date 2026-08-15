import { describe, expect, it } from 'vitest'

import { Account } from './index.js'

describe('Account', () => {
  it('creates an accessible free account with its authenticated identity', () => {
    const factory = Reflect.get(Account, 'create')

    expect(factory).toBeTypeOf('function')

    if (typeof factory !== 'function') return

    const account = factory({
      id: 'account-1',
      email: 'person@example.com',
      authUserId: 'auth-user-1',
      timeZone: 'America/Sao_Paulo',
      createdAt: new Date('2026-08-15T00:00:00.000Z'),
    })

    expect(account).toMatchObject({
      id: 'account-1',
      email: 'person@example.com',
      authUserId: 'auth-user-1',
      timeZone: 'America/Sao_Paulo',
      plan: 'free',
      status: 'accessible',
    })
  })
})
