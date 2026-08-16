import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import type { AccessTokenValidator } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { EventPublisher } from '@/modules/accounts/domain/ports/event-publisher/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { CreateAccountUseCase } from './index.js'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const NEUTRAL_MESSAGE =
  'Verifique seu e-mail para continuar, caso exista uma conta elegível para este endereço.'

class InMemoryAccountsRepository implements AccountsRepository {
  readonly saved: Account[] = []

  constructor(
    private readonly existing: Account | null = null,
    private readonly accountCount = existing === null ? 0 : 1,
  ) {}

  count(): Promise<number> {
    return Promise.resolve(this.accountCount + this.saved.length)
  }

  findByAuthUserId(authUserId: string): Promise<Account | null> {
    return Promise.resolve(
      this.saved.find((account) => account.authUserId === authUserId) ??
        (this.existing?.authUserId === authUserId ? this.existing : null),
    )
  }

  findById(accountId: string): Promise<Account | null> {
    return Promise.resolve(
      this.saved.find((account) => account.id === accountId) ??
        (this.existing?.id === accountId ? this.existing : null),
    )
  }

  findByEmail(email: string): Promise<Account | null> {
    return Promise.resolve(
      this.saved.find((account) => account.email.value === email) ??
        (this.existing?.email.value === email ? this.existing : null),
    )
  }

  save(account: Account): Promise<void> {
    this.saved.push(account)
    return Promise.resolve()
  }
}

class FixedAuthIdentityProvider implements AccessTokenValidator {
  readonly validatedTokens: string[] = []

  constructor(private readonly authUserId = 'auth-user-1') {}

  validateAccessToken(accessToken: string) {
    this.validatedTokens.push(accessToken)
    return Promise.resolve({
      authUserId: this.authUserId,
      email: 'person@example.com',
      issuedAt: NOW,
      sessionId: 'session-1',
      authenticationMethod: 'password' as const,
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

function existingAccount(): Account {
  return Account.create({
    id: 'account-existing',
    email: EmailAddress.create('person@example.com'),
    authUserId: 'auth-user-1',
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: NOW,
  })
}

function createHarness(
  existing: Account | null = null,
  authUserId = 'auth-user-1',
  accountCount?: number,
) {
  const accounts = new InMemoryAccountsRepository(existing, accountCount)
  const authIdentityProvider = new FixedAuthIdentityProvider(authUserId)
  const eventPublisher = new RecordingEventPublisher()
  let transactionRuns = 0
  let generatedIds = 0

  const useCase = new CreateAccountUseCase({
    accounts,
    authIdentityProvider,
    clock: { now: () => NOW },
    eventPublisher,
    idGenerator: { generate: () => `generated-${(generatedIds += 1)}` },
    unitOfWork: {
      run: async (operation) => {
        transactionRuns += 1
        return operation()
      },
    },
  })

  return {
    accounts,
    authIdentityProvider,
    eventPublisher,
    transactionRuns: () => transactionRuns,
    useCase,
  }
}

describe('CreateAccountUseCase', () => {
  it('creates a free account only from a validated access token', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', timeZone: 'Europe/Lisbon' }),
    ).resolves.toEqual({ message: NEUTRAL_MESSAGE })

    expect(harness.authIdentityProvider.validatedTokens).toEqual(['verified-token'])
    expect(harness.accounts.saved).toHaveLength(1)
    expect(harness.accounts.saved[0]).toMatchObject({
      id: 'generated-1',
      authUserId: 'auth-user-1',
      plan: 'free',
      status: 'accessible',
    })
    expect(harness.accounts.saved[0]?.email.value).toBe('person@example.com')
    expect(harness.accounts.saved[0]?.timeZone.value).toBe('Europe/Lisbon')
    expect(harness.transactionRuns()).toBe(1)
  })

  it('binds the account to the session that provisioned it', async () => {
    const harness = createHarness()

    await harness.useCase.execute({ accessToken: 'verified-token', timeZone: null })

    expect(harness.accounts.saved[0]?.hasCurrentSession('session-1')).toBe(true)
  })

  it('publishes account_created with the account and current plan', async () => {
    const harness = createHarness()

    await harness.useCase.execute({ accessToken: 'verified-token', timeZone: null })

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventId: 'generated-2',
        eventName: 'account_created',
        occurredAt: NOW,
        payload: {
          accountId: 'generated-1',
          plan: 'free',
          origin: 'api',
          authenticationMethod: 'password',
        },
      }),
    )
  })

  it('returns the same neutral message and publishes rejection for an existing identity', async () => {
    const harness = createHarness(existingAccount())

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', timeZone: 'America/Sao_Paulo' }),
    ).resolves.toEqual({ message: NEUTRAL_MESSAGE })

    expect(harness.accounts.saved).toHaveLength(0)
    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'account_creation_rejected',
        payload: { accountId: 'account-existing', plan: 'free', reason: 'duplicate' },
      }),
    )
  })

  it('uses the product fallback when the browser time zone is absent', async () => {
    const harness = createHarness()

    await harness.useCase.execute({ accessToken: 'verified-token', timeZone: null })

    expect(harness.accounts.saved[0]?.timeZone.value).toBe('America/Sao_Paulo')
  })

  it('does not reveal an existing email linked to another external identity', async () => {
    const harness = createHarness(existingAccount(), 'different-auth-user')

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', timeZone: 'America/Sao_Paulo' }),
    ).resolves.toEqual({ message: NEUTRAL_MESSAGE })

    expect(harness.accounts.saved).toHaveLength(0)
    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'account_creation_rejected',
        payload: { accountId: 'account-existing', plan: 'free', reason: 'duplicate' },
      }),
    )
  })

  it('rejects the one hundred and first account inside the reservation transaction', async () => {
    const harness = createHarness(null, 'auth-user-101', 100)

    await expect(
      harness.useCase.execute({ accessToken: 'verified-token', timeZone: 'America/Sao_Paulo' }),
    ).rejects.toMatchObject({
      code: 'accounts.BETA_CAPACITY_REACHED',
      context: { capacity: 100, accountCount: 100 },
    })

    expect(harness.accounts.saved).toHaveLength(0)
    expect(harness.transactionRuns()).toBe(1)
    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'beta_capacity_reached',
        payload: { accountId: null, plan: 'free', capacity: 100 },
      }),
    )
  })
})
