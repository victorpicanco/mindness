import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { AcceptConsentUseCase } from './index.js'

const NOW = new Date('2026-08-15T12:00:00.000Z')

class InMemoryAccountsRepository implements AccountsRepository {
  readonly saved: Account[] = []

  constructor(private readonly account: Account) {}

  count(): Promise<number> {
    return Promise.resolve(1)
  }

  findByAuthUserId(authUserId: string): Promise<Account | null> {
    return Promise.resolve(this.account.authUserId === authUserId ? this.account : null)
  }

  findById(accountId: string): Promise<Account | null> {
    return Promise.resolve(this.account.id === accountId ? this.account : null)
  }

  findByEmail(email: string): Promise<Account | null> {
    return Promise.resolve(this.account.email.value === email ? this.account : null)
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
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  })
  const accounts = new InMemoryAccountsRepository(account)
  const events: IntegrationEvent[] = []

  const useCase = new AcceptConsentUseCase({
    accounts,
    authIdentityProvider: {
      validateAccessToken: () =>
        Promise.resolve({
          authUserId: 'auth-user-1',
          email: 'person@example.com',
          issuedAt: NOW,
          sessionId: 'session-1',
          authenticationMethod: 'password',
        }),
    },
    clock: { now: () => NOW },
    consentVersion: '2026-08-15',
    eventPublisher: {
      publish: (event) => {
        events.push(event)
        return Promise.resolve()
      },
    },
    idGenerator: { generate: () => 'event-1' },
    unitOfWork: { run: (operation) => operation() },
  })

  return { accounts, events, useCase }
}

describe('AcceptConsentUseCase', () => {
  it('records the configured voice consent and publishes consent_accepted', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute({ accessToken: 'verified-token' })).resolves.toEqual({
      acceptedAt: NOW.toISOString(),
      purpose: 'voice_recording_and_analysis',
      version: '2026-08-15',
    })

    expect(harness.accounts.saved).toHaveLength(1)
    expect(harness.accounts.saved[0]).toMatchObject({
      voiceConsent: {
        acceptedAt: NOW,
        purpose: 'voice_recording_and_analysis',
        version: '2026-08-15',
      },
    })
    expect(harness.events).toContainEqual(
      expect.objectContaining({
        eventName: 'consent_accepted',
        payload: {
          accountId: 'account-1',
          plan: 'free',
          purpose: 'voice_recording_and_analysis',
          version: '2026-08-15',
        },
      }),
    )
  })

  it('keeps acceptance idempotent for the same configured consent version', async () => {
    const harness = createHarness()

    const first = await harness.useCase.execute({ accessToken: 'verified-token' })
    const second = await harness.useCase.execute({ accessToken: 'verified-token' })

    expect(second).toEqual(first)
    expect(harness.accounts.saved).toHaveLength(1)
    expect(harness.events.filter((event) => event.eventName === 'consent_accepted')).toHaveLength(1)
  })
})
