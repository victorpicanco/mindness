import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { AuthSession } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { CompleteGoogleSignInUseCase } from './index.js'

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

class StubGoogleExchange {
  readonly exchanges: { code: string; pkceState: string }[] = []
  rejection: AuthenticationRejectedError | null = null

  exchangeGoogleCode(code: string, pkceState: string): Promise<AuthSession> {
    this.exchanges.push({ code, pkceState })
    if (this.rejection !== null) return Promise.reject(this.rejection)

    return Promise.resolve({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-08-15T13:00:00.000Z'),
      identity: {
        authUserId: 'auth-user-1',
        email: 'person@example.com',
        sessionId: 'session-2',
        issuedAt: NOW,
        authenticationMethod: 'google',
      },
    })
  }
}

class RecordingEventPublisher implements EventPublisher {
  readonly published: IntegrationEvent[] = []

  publish(event: IntegrationEvent): Promise<void> {
    this.published.push(event)
    return Promise.resolve()
  }
}

function createHarness(existing: Account | null = null) {
  const accounts = new InMemoryAccountsRepository(existing)
  const authIdentityProvider = new StubGoogleExchange()
  const eventPublisher = new RecordingEventPublisher()
  let generatedIds = 0

  const useCase = new CompleteGoogleSignInUseCase({
    accounts,
    authIdentityProvider,
    clock: { now: () => NOW },
    eventPublisher,
    idGenerator: { generate: () => `generated-${(generatedIds += 1)}` },
    unitOfWork: { run: (operation) => operation() },
  })

  return { accounts, authIdentityProvider, eventPublisher, useCase }
}

describe('CompleteGoogleSignInUseCase', () => {
  it('exchanges the authorized code for a session', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({
        code: 'authorization-code',
        error: null,
        pkceState: 'opaque-pkce-state',
      }),
    ).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-15T13:00:00.000Z',
    })

    expect(harness.authIdentityProvider.exchanges).toEqual([
      { code: 'authorization-code', pkceState: 'opaque-pkce-state' },
    ])
  })

  it('publishes google_login_rejected without exchanging when google reports an error', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({
        code: null,
        error: 'access_denied',
        pkceState: 'opaque-pkce-state',
      }),
    ).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'google_failed' },
    })

    expect(harness.authIdentityProvider.exchanges).toEqual([])
    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'google_login_rejected',
        payload: { accountId: null, plan: null, reason: 'google_failed' },
      }),
    )
  })

  it('publishes google_login_rejected without exchanging when the pkce state is missing', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ code: 'authorization-code', error: null, pkceState: null }),
    ).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'google_failed' },
    })

    expect(harness.authIdentityProvider.exchanges).toEqual([])
  })

  it('makes the google session the only one an existing account accepts', async () => {
    const existing = accountFor()
    existing.startSession('session-1')
    const harness = createHarness(existing)

    await harness.useCase.execute({
      code: 'authorization-code',
      error: null,
      pkceState: 'opaque-pkce-state',
    })

    expect(harness.accounts.saved).toHaveLength(1)
    expect(existing.hasCurrentSession('session-2')).toBe(true)
  })

  it('publishes google_login_rejected and rethrows when the provider refuses', async () => {
    const harness = createHarness()
    harness.authIdentityProvider.rejection = new AuthenticationRejectedError('google_failed')

    await expect(
      harness.useCase.execute({
        code: 'authorization-code',
        error: null,
        pkceState: 'stale-pkce-state',
      }),
    ).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'google_failed' },
    })

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'google_login_rejected',
        occurredAt: NOW,
        payload: { accountId: null, plan: null, reason: 'google_failed' },
      }),
    )
  })
})
