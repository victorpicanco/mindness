import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { DISPLAY_NAME_MAX_LENGTH } from '@/modules/accounts/domain/value-objects/display-name/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import { UpdateAccountNameUseCase } from './index.js'

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
  const useCase = new UpdateAccountNameUseCase({
    accounts,
    authIdentityProvider: {
      validateAccessToken: () =>
        Promise.resolve({
          authUserId: 'auth-user-1',
          email: 'person@example.com',
          issuedAt: new Date('2026-08-15T00:00:00.000Z'),
          sessionId: 'session-1',
          authenticationMethod: 'password',
        }),
    },
    unitOfWork: { run: (operation) => operation() },
  })

  return { account, accounts, useCase }
}

describe('UpdateAccountNameUseCase', () => {
  it('names the authenticated account', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', name: 'Maria Silva' }),
    ).resolves.toEqual({ name: 'Maria Silva' })

    expect(harness.account.name?.value).toBe('Maria Silva')
    expect(harness.accounts.saved).toEqual([harness.account])
  })

  it('stores the name without its surrounding whitespace', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', name: '  Maria Silva  ' }),
    ).resolves.toEqual({ name: 'Maria Silva' })
  })

  it('rejects a blank name without persisting changes', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', name: '   ' }),
    ).rejects.toBeInstanceOf(InvalidAccountValueError)

    expect(harness.account.name).toBeNull()
    expect(harness.accounts.saved).toHaveLength(0)
  })

  it('rejects a name longer than the maximum length without persisting changes', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({
        accessToken: 'verified-token',
        name: 'a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1),
      }),
    ).rejects.toBeInstanceOf(InvalidAccountValueError)

    expect(harness.account.name).toBeNull()
    expect(harness.accounts.saved).toHaveLength(0)
  })
})
