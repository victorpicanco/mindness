import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type {
  AuthSession,
  SignInWithPasswordParams,
} from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { SignInUseCase } from './index.js'

const NOW = new Date('2026-08-15T12:00:00.000Z')

const credentials = {
  email: 'Person@Example.com',
  password: 'Strong_password1!',
  captchaToken: 'captcha-token',
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

class StubIdentitySignIn {
  readonly attempts: SignInWithPasswordParams[] = []
  rejection: AuthenticationRejectedError | null = null

  signInWithPassword(params: SignInWithPasswordParams): Promise<AuthSession> {
    this.attempts.push(params)
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
        authenticationMethod: 'password',
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
  const authIdentityProvider = new StubIdentitySignIn()
  const eventPublisher = new RecordingEventPublisher()
  let generatedIds = 0

  const useCase = new SignInUseCase({
    accounts,
    authIdentityProvider,
    clock: { now: () => NOW },
    eventPublisher,
    idGenerator: { generate: () => `generated-${(generatedIds += 1)}` },
    unitOfWork: { run: (operation) => operation() },
  })

  return { accounts, authIdentityProvider, eventPublisher, useCase }
}

describe('SignInUseCase', () => {
  it('issues a session for correct credentials', async () => {
    const harness = createHarness(accountFor())

    await expect(harness.useCase.execute(credentials)).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-15T13:00:00.000Z',
    })

    expect(harness.authIdentityProvider.attempts).toEqual([
      {
        email: 'person@example.com',
        password: credentials.password,
        captchaToken: 'captcha-token',
      },
    ])
  })

  it('makes the new session the only one the account accepts', async () => {
    const existing = accountFor()
    existing.startSession('session-1')
    const harness = createHarness(existing)

    await harness.useCase.execute(credentials)

    expect(harness.accounts.saved).toHaveLength(1)
    expect(existing.hasCurrentSession('session-1')).toBe(false)
    expect(existing.hasCurrentSession('session-2')).toBe(true)
  })

  it('issues a session before the account exists, without persisting anything', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute(credentials)).resolves.toMatchObject({
      accessToken: 'access-token',
    })

    expect(harness.accounts.saved).toHaveLength(0)
  })

  it('publishes login_rejected with the account behind the email and rethrows', async () => {
    const harness = createHarness(accountFor())
    harness.authIdentityProvider.rejection = new AuthenticationRejectedError('invalid_credentials')

    await expect(harness.useCase.execute(credentials)).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
    })

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'login_rejected',
        occurredAt: NOW,
        payload: { accountId: 'account-1', plan: 'free', reason: 'invalid_credentials' },
      }),
    )
  })

  it('publishes login_rejected without an account when the email is unknown', async () => {
    const harness = createHarness()
    harness.authIdentityProvider.rejection = new AuthenticationRejectedError('invalid_credentials')

    await expect(harness.useCase.execute(credentials)).rejects.toBeInstanceOf(
      AuthenticationRejectedError,
    )

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'login_rejected',
        payload: { accountId: null, plan: null, reason: 'invalid_credentials' },
      }),
    )
  })
})
