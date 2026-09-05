import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { DisplayName } from '@/modules/accounts/domain/value-objects/display-name/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { AccountRow } from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'

import { AccountMapper } from './index.js'

const row: AccountRow = {
  id: '2f1a3c2e-7b64-4f4a-9a1e-6f6a2c9b7d10',
  email: 'person@example.com',
  authUserId: 'auth-user-1',
  timeZone: 'America/Sao_Paulo',
  name: null,
  plan: 'free',
  status: 'accessible',
  consentPurpose: null,
  consentVersion: null,
  consentAcceptedAt: null,
  currentSessionId: null,
  createdAt: new Date('2026-08-15T00:00:00.000Z'),
}

describe('AccountMapper', () => {
  it('reconstitutes the aggregate from the persisted row', () => {
    const account = new AccountMapper().toDomain(row)

    expect(account).toBeInstanceOf(Account)
    expect(account).toMatchObject({
      id: row.id,
      authUserId: row.authUserId,
      plan: 'free',
      status: 'accessible',
      createdAt: row.createdAt,
    })
  })

  it('rebuilds the persisted columns as validated value objects', () => {
    const account = new AccountMapper().toDomain(row)

    expect(account.email).toBeInstanceOf(EmailAddress)
    expect(account.email.equals(EmailAddress.create(row.email))).toBe(true)
    expect(account.timeZone).toBeInstanceOf(TimeZone)
    expect(account.timeZone.equals(TimeZone.create(row.timeZone))).toBe(true)
  })

  it('maps the aggregate back to the persisted row without losing state', () => {
    const mapper = new AccountMapper()

    expect(mapper.toPersistence(mapper.toDomain(row))).toEqual(row)
  })

  it('maps a freshly created aggregate to its persisted row', () => {
    const account = Account.create({
      id: row.id,
      email: EmailAddress.create(row.email),
      authUserId: row.authUserId,
      timeZone: TimeZone.create(row.timeZone),
      createdAt: row.createdAt,
    })

    expect(new AccountMapper().toPersistence(account)).toEqual(row)
  })

  it('round-trips the name as a validated value object', () => {
    const mapper = new AccountMapper()
    const account = mapper.toDomain({ ...row, name: 'Maria Silva' })

    expect(account.name).toBeInstanceOf(DisplayName)
    expect(account.name?.value).toBe('Maria Silva')
    expect(mapper.toPersistence(account).name).toBe('Maria Silva')
  })

  it('keeps an account that was never named without a name', () => {
    const mapper = new AccountMapper()

    expect(mapper.toDomain(row).name).toBeNull()
    expect(mapper.toPersistence(mapper.toDomain(row)).name).toBeNull()
  })

  it('round-trips the current authenticated session', () => {
    const mapper = new AccountMapper()
    const account = mapper.toDomain({ ...row, currentSessionId: 'session-1' })

    expect(account.hasCurrentSession('session-1')).toBe(true)
    expect(mapper.toPersistence(account).currentSessionId).toBe('session-1')
  })
})
