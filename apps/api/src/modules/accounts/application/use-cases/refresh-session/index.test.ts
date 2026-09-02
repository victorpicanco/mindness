import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type {
  AuthSession,
  RefreshTokenAuthenticator,
} from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import { RefreshSessionUseCase } from './index.js'

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

class StubRefreshTokenAuthenticator implements RefreshTokenAuthenticator {
  readonly refreshTokens: string[] = []
  rejection: AuthenticationRejectedError | null = null

  constructor(private readonly sessionId = 'session-2') {}

  refreshSession(refreshToken: string): Promise<AuthSession> {
    this.refreshTokens.push(refreshToken)
    if (this.rejection !== null) return Promise.reject(this.rejection)

    return Promise.resolve({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: new Date('2026-08-15T13:00:00.000Z'),
      identity: {
        authUserId: 'auth-user-1',
        email: 'person@example.com',
        sessionId: this.sessionId,
        issuedAt: NOW,
        authenticationMethod: 'password',
      },
    })
  }
}

function createHarness(existing: Account | null = null, sessionId?: string) {
  const authIdentityProvider = new StubRefreshTokenAuthenticator(sessionId)

  return {
    authIdentityProvider,
    useCase: new RefreshSessionUseCase({
      accounts: new InMemoryAccountsRepository(existing),
      authIdentityProvider,
    }),
  }
}

describe('RefreshSessionUseCase', () => {
  it('returns the refreshed session tokens', async () => {
    const account = accountFor()
    account.startSession('session-2')
    const harness = createHarness(account)

    await expect(
      harness.useCase.execute({ refreshToken: 'current-refresh-token' }),
    ).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: '2026-08-15T13:00:00.000Z',
    })
    expect(harness.authIdentityProvider.refreshTokens).toEqual(['current-refresh-token'])
  })

  it('refreshes a verified identity that has no account yet', async () => {
    await expect(
      createHarness().useCase.execute({ refreshToken: 'current-refresh-token' }),
    ).resolves.toMatchObject({ accessToken: 'new-access-token' })
  })

  it('rejects a device whose session was replaced by a newer login', async () => {
    const account = accountFor()
    account.startSession('session-1')

    await expect(
      createHarness(account).useCase.execute({ refreshToken: 'replaced-refresh-token' }),
    ).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'invalid_token' },
    })
  })

  it('rejects an account whose deletion is already scheduled', async () => {
    const account = accountFor()
    account.startSession('session-2')
    account.scheduleDeletion()

    await expect(
      createHarness(account).useCase.execute({ refreshToken: 'current-refresh-token' }),
    ).rejects.toBeInstanceOf(AuthenticationRejectedError)
  })

  it('propagates an invalid refresh token rejection', async () => {
    const harness = createHarness(accountFor())
    harness.authIdentityProvider.rejection = new AuthenticationRejectedError(
      'refresh_token_invalid',
    )

    await expect(
      harness.useCase.execute({ refreshToken: 'expired-refresh-token' }),
    ).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'refresh_token_invalid' },
    })
  })
})
