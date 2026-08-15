import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import { UpdateTimeZoneUseCase } from './index.js'

class InMemoryAccountsRepository implements AccountsRepository {
  readonly saved: Account[] = []

  constructor(private readonly account: Account) {}

  count(): Promise<number> {
    return Promise.resolve(1)
  }

  findById(): Promise<Account | null> {
    return Promise.resolve(null)
  }

  findByAuthUserId(authUserId: string): Promise<Account | null> {
    return Promise.resolve(this.account.authUserId === authUserId ? this.account : null)
  }

  findByEmail(): Promise<Account | null> {
    return Promise.resolve(null)
  }

  save(account: Account): Promise<void> {
    this.saved.push(account)
    return Promise.resolve()
  }
}

function createHarness() {
  const account = Account.create({
    id: 'account-1',
    email: EmailAddress.create('person@example.com'),
    authUserId: 'auth-user-1',
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
  })
  const accounts = new InMemoryAccountsRepository(account)
  const useCase = new UpdateTimeZoneUseCase({
    accounts,
    authIdentityProvider: {
      validateAccessToken: () =>
        Promise.resolve({
          authUserId: 'auth-user-1',
          email: 'person@example.com',
          issuedAt: new Date('2026-08-15T00:00:00.000Z'),
          sessionId: 'session-1',
        }),
    },
    unitOfWork: { run: (operation) => operation() },
  })

  return { account, accounts, useCase }
}

describe('UpdateTimeZoneUseCase', () => {
  it('updates only the authenticated account with a valid IANA time zone', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', timeZone: 'Europe/Lisbon' }),
    ).resolves.toEqual({ timeZone: 'Europe/Lisbon' })

    expect(harness.account.timeZone.value).toBe('Europe/Lisbon')
    expect(harness.accounts.saved).toEqual([harness.account])
  })

  it('rejects an invalid IANA time zone without persisting changes', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', timeZone: 'Mars/Olympus' }),
    ).rejects.toBeInstanceOf(InvalidAccountValueError)

    expect(harness.account.timeZone.value).toBe('America/Sao_Paulo')
    expect(harness.accounts.saved).toHaveLength(0)
  })
})
