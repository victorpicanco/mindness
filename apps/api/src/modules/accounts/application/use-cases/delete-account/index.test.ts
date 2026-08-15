import { describe, expect, it } from 'vitest'

import type { AccountDeletionRequest } from '@/modules/accounts/domain/entities/account-deletion-request/index.js'
import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import type { AccountDeletionRequestsRepository } from '@/modules/accounts/domain/repositories/account-deletion-requests-repository/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

import { DeleteAccountUseCase } from './index.js'

const NOW = new Date('2026-08-15T12:00:00.000Z')
const SCHEDULED_FOR = new Date('2026-09-14T12:00:00.000Z')

class InMemoryAccountsRepository implements AccountsRepository {
  constructor(
    private readonly account: Account,
    private readonly calls: string[],
  ) {}

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

  save(): Promise<void> {
    this.calls.push('save-account')
    return Promise.resolve()
  }
}

class InMemoryDeletionRequestsRepository implements AccountDeletionRequestsRepository {
  readonly saved: AccountDeletionRequest[] = []

  constructor(private readonly calls: string[]) {}

  save(request: AccountDeletionRequest): Promise<void> {
    this.calls.push('save-request')
    this.saved.push(request)
    return Promise.resolve()
  }
}

function createHarness(issuedAt = new Date(NOW.getTime() - 4 * 60 * 1000)) {
  const calls: string[] = []
  const account = Account.create({
    id: 'account-1',
    email: EmailAddress.create('person@example.com'),
    authUserId: 'auth-user-1',
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
  })
  const events: IntegrationEvent[] = []
  const deletionRequests = new InMemoryDeletionRequestsRepository(calls)
  let generatedIds = 0
  const useCase = new DeleteAccountUseCase({
    accounts: new InMemoryAccountsRepository(account, calls),
    authIdentityProvider: {
      validateAccessToken: () =>
        Promise.resolve({
          authUserId: 'auth-user-1',
          email: 'person@example.com',
          issuedAt,
          sessionId: 'session-1',
        }),
      revokeSession: () => {
        calls.push('revoke-session')
        return Promise.resolve()
      },
    },
    clock: { now: () => NOW },
    deletionRequests,
    eventPublisher: {
      publish: (event) => {
        calls.push('publish-event')
        events.push(event)
        return Promise.resolve()
      },
    },
    idGenerator: { generate: () => `generated-${(generatedIds += 1)}` },
    subscriptionCancellation: {
      cancelActiveSubscription: () => {
        calls.push('cancel-subscription')
        return Promise.resolve()
      },
    },
    unitOfWork: { run: (operation) => operation() },
  })

  return { account, calls, deletionRequests, events, useCase }
}

describe('DeleteAccountUseCase', () => {
  it('cancels billing, revokes access immediately and schedules physical deletion in 30 days', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute({ accessToken: 'recent-token' })).resolves.toEqual({
      scheduledFor: SCHEDULED_FOR.toISOString(),
    })

    expect(harness.account).toMatchObject({ status: 'deletion_pending' })
    expect(harness.deletionRequests.saved).toEqual([
      expect.objectContaining({
        id: 'generated-1',
        accountId: 'account-1',
        requestedAt: NOW,
        scheduledFor: SCHEDULED_FOR,
      }),
    ])
    expect(harness.events).toContainEqual(
      expect.objectContaining({
        eventName: 'account_deletion_requested',
        payload: {
          accountId: 'account-1',
          plan: 'free',
          scheduledFor: SCHEDULED_FOR.toISOString(),
        },
      }),
    )
    expect(harness.calls).toEqual([
      'cancel-subscription',
      'save-account',
      'save-request',
      'publish-event',
      'revoke-session',
    ])
  })

  it('requires authentication issued within the last five minutes', async () => {
    const harness = createHarness(new Date(NOW.getTime() - 5 * 60 * 1000 - 1))

    await expect(harness.useCase.execute({ accessToken: 'stale-token' })).rejects.toMatchObject({
      code: 'accounts.REAUTHENTICATION_REQUIRED',
      httpStatus: 401,
      context: { maximumAgeSeconds: 300 },
    })

    expect(harness.calls).toHaveLength(0)
    expect(harness.account.status).toBe('accessible')
  })
})
