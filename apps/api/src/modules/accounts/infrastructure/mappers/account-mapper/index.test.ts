import { describe, expect, it } from 'vitest'

import { Account } from '../../../domain/entities/account/index.js'
import type { AccountRow } from '../../clients/accounts-prisma-client/index.js'

import { AccountMapper } from './index.js'

const row: AccountRow = {
  id: '2f1a3c2e-7b64-4f4a-9a1e-6f6a2c9b7d10',
  email: 'person@example.com',
  authUserId: 'auth-user-1',
  timeZone: 'America/Sao_Paulo',
  plan: 'free',
  status: 'accessible',
  createdAt: new Date('2026-08-15T00:00:00.000Z'),
}

describe('AccountMapper', () => {
  it('reconstitutes the aggregate from the persisted row', () => {
    const account = new AccountMapper().toDomain(row)

    expect(account).toBeInstanceOf(Account)
    expect(account).toMatchObject({
      id: row.id,
      email: row.email,
      authUserId: row.authUserId,
      timeZone: row.timeZone,
      plan: 'free',
      status: 'accessible',
      createdAt: row.createdAt,
    })
  })

  it('maps the aggregate back to the persisted row without losing state', () => {
    const mapper = new AccountMapper()

    expect(mapper.toPersistence(mapper.toDomain(row))).toEqual(row)
  })
})
