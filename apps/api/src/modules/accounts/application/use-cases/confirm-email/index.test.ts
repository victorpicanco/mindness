import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import type { AuthSession } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import { ConfirmEmailUseCase } from './index.js'

const NOW = new Date('2026-08-15T12:00:00.000Z')

const session: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date('2026-08-15T13:00:00.000Z'),
  identity: {
    authUserId: 'auth-user-1',
    email: 'person@example.com',
    sessionId: 'session-1',
    issuedAt: NOW,
    authenticationMethod: 'password',
  },
}

function accountFor(authUserId = 'auth-user-1'): Account {
  return Account.create({
    id: 'account-1',
    email: EmailAddress.create('person@example.com'),
    authUserId,
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: NOW,
  })
}

class InMemoryAccountsRepository implements AccountsRepository {
  readonly saved: Account[] = []

  constructor(private readonly existing: Account | null = null) {}

  count(): Promise<number> {
    return Promise.resolve(this.existing === null ? 0 : 1)
  }

  findById(accountId: string): Promise<Account | null> {
    return Promise.resolve(this.existing?.id === accountId ? this.existing : null)
  }

  findByAuthUserId(authUserId: string): Promise<Account | null> {
    return Promise.resolve(this.existing?.authUserId === authUserId ? this.existing : null)
  }

  findByEmail(email: string): Promise<Account | null> {
    return Promise.resolve(this.existing?.email.value === email ? this.existing : null)
  }

  save(account: Account): Promise<void> {
    this.saved.push(account)
    return Promise.resolve()
  }
}

function createUseCase(
  accounts: AccountsRepository,
  verifyEmailOtp: (tokenHash: string, type: 'email' | 'recovery') => Promise<AuthSession>,
): ConfirmEmailUseCase {
  return new ConfirmEmailUseCase({
    accounts,
    authIdentityProvider: { verifyEmailOtp },
    unitOfWork: { run: (operation) => operation() },
  })
}

describe('ConfirmEmailUseCase', () => {
  it('exchanges the token hash for serializable session tokens', async () => {
    const calls: string[] = []
    const useCase = createUseCase(new InMemoryAccountsRepository(), (tokenHash, type) => {
      calls.push(`${type}:${tokenHash}`)
      return Promise.resolve(session)
    })

    await expect(useCase.execute({ tokenHash: 'token-hash', type: 'email' })).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-15T13:00:00.000Z',
    })
    expect(calls).toEqual(['email:token-hash'])
  })

  it('registers the confirmed session on the account', async () => {
    const account = accountFor()
    const accounts = new InMemoryAccountsRepository(account)
    const useCase = createUseCase(accounts, () => Promise.resolve(session))

    await useCase.execute({ tokenHash: 'token-hash', type: 'recovery' })

    expect(accounts.saved).toEqual([account])
    expect(account.canAuthenticate('session-1')).toBe(true)
  })

  it('confirms the email when no account was provisioned yet', async () => {
    const accounts = new InMemoryAccountsRepository()
    const useCase = createUseCase(accounts, () => Promise.resolve(session))

    await expect(
      useCase.execute({ tokenHash: 'token-hash', type: 'email' }),
    ).resolves.toMatchObject({ accessToken: 'access-token' })
    expect(accounts.saved).toEqual([])
  })
})
