import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import { AuthenticateUseCase } from './index.js'

const NOW = new Date('2026-08-15T12:00:00.000Z')

function accountFor(): Account {
  return Account.create({
    id: 'account-1',
    email: EmailAddress.create('person@example.com'),
    authUserId: 'auth-user-1',
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: NOW,
  })
}

class InMemoryAccountsRepository implements AccountsRepository {
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

  save(): Promise<void> {
    return Promise.resolve()
  }
}

class StubTokenValidator {
  rejection: AuthenticationRejectedError | null = null

  constructor(private readonly sessionId = 'session-1') {}

  validateAccessToken(): Promise<VerifiedAuthIdentity> {
    if (this.rejection !== null) return Promise.reject(this.rejection)

    return Promise.resolve({
      authUserId: 'auth-user-1',
      email: 'person@example.com',
      sessionId: this.sessionId,
      issuedAt: NOW,
      authenticationMethod: 'password',
    })
  }
}

function createHarness(existing: Account | null = null, sessionId?: string) {
  const authIdentityProvider = new StubTokenValidator(sessionId)

  return {
    authIdentityProvider,
    useCase: new AuthenticateUseCase({
      accounts: new InMemoryAccountsRepository(existing),
      authIdentityProvider,
    }),
  }
}

describe('AuthenticateUseCase', () => {
  it('derives the identity from the validated token', async () => {
    const account = accountFor()
    account.startSession('session-1')

    await expect(
      createHarness(account).useCase.execute({ accessToken: 'access-token' }),
    ).resolves.toEqual({
      accountId: 'account-1',
      authUserId: 'auth-user-1',
      email: 'person@example.com',
      authenticationMethod: 'password',
      sessionId: 'session-1',
      issuedAt: NOW,
    })
  })

  it('authenticates a verified identity that has no account yet', async () => {
    await expect(
      createHarness().useCase.execute({ accessToken: 'access-token' }),
    ).resolves.toMatchObject({ accountId: null, authUserId: 'auth-user-1' })
  })

  it('rejects a device whose session was replaced by a newer login', async () => {
    const account = accountFor()
    account.startSession('session-2')

    await expect(
      createHarness(account, 'session-1').useCase.execute({ accessToken: 'stale-token' }),
    ).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'invalid_token' },
    })
  })

  it('rejects an account whose deletion is already scheduled', async () => {
    const account = accountFor()
    account.startSession('session-1')
    account.scheduleDeletion()

    await expect(
      createHarness(account).useCase.execute({ accessToken: 'access-token' }),
    ).rejects.toBeInstanceOf(AuthenticationRejectedError)
  })

  it('propagates a token the provider refuses', async () => {
    const harness = createHarness(accountFor())
    harness.authIdentityProvider.rejection = new AuthenticationRejectedError('invalid_token')

    await expect(harness.useCase.execute({ accessToken: 'forged' })).rejects.toBeInstanceOf(
      AuthenticationRejectedError,
    )
  })
})
