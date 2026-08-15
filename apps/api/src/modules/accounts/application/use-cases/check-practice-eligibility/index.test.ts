import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'

import { CheckPracticeEligibilityUseCase } from './index.js'

class InMemoryAccountsRepository implements AccountsRepository {
  constructor(private readonly account: Account) {}

  count(): Promise<number> {
    return Promise.resolve(1)
  }

  findById(accountId: string): Promise<Account | null> {
    return Promise.resolve(this.account.id === accountId ? this.account : null)
  }

  findByAuthUserId(): Promise<Account | null> {
    return Promise.resolve(null)
  }

  findByEmail(): Promise<Account | null> {
    return Promise.resolve(null)
  }

  save(): Promise<void> {
    return Promise.resolve()
  }
}

function account(): Account {
  return Account.create({
    id: 'account-1',
    email: EmailAddress.create('person@example.com'),
    authUserId: 'auth-user-1',
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: new Date('2026-08-15T00:00:00.000Z'),
  })
}

describe('CheckPracticeEligibilityUseCase', () => {
  it('denies practice until voice consent is registered', async () => {
    const stored = account()
    const useCase = new CheckPracticeEligibilityUseCase(new InMemoryAccountsRepository(stored))

    await expect(useCase.execute({ accountId: stored.id })).resolves.toEqual({ eligible: false })
  })

  it('allows practice after voice consent is registered', async () => {
    const stored = account()
    stored.acceptVoiceConsent(
      VoiceConsent.create({
        version: '2026-08-15',
        acceptedAt: new Date('2026-08-15T12:00:00.000Z'),
      }),
    )
    const useCase = new CheckPracticeEligibilityUseCase(new InMemoryAccountsRepository(stored))

    await expect(useCase.execute({ accountId: stored.id })).resolves.toEqual({ eligible: true })
  })
})
