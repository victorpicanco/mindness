import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AccountNotFoundError } from '@/modules/accounts/domain/errors/account-not-found-error/index.js'
import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'

import { GetAccountProfileUseCase } from './index.js'

const NOW = new Date('2026-08-15T12:00:00.000Z')

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

const authIdentityProvider = {
  validateAccessToken(): Promise<VerifiedAuthIdentity> {
    return Promise.resolve({
      authUserId: 'auth-user-1',
      email: 'person@example.com',
      sessionId: 'session-1',
      issuedAt: NOW,
      authenticationMethod: 'password',
    })
  },
}

function createUseCase(existing: Account | null = null): GetAccountProfileUseCase {
  return new GetAccountProfileUseCase({
    accounts: new InMemoryAccountsRepository(existing),
    authIdentityProvider,
  })
}

describe('GetAccountProfileUseCase', () => {
  it('returns the profile of the account behind the validated identity', async () => {
    await expect(
      createUseCase(accountFor()).execute({ accessToken: 'access-token' }),
    ).resolves.toEqual({
      accountId: 'account-1',
      email: 'person@example.com',
      timeZone: 'America/Sao_Paulo',
      plan: 'free',
      consent: null,
    })
  })

  it('exposes the recorded voice consent', async () => {
    const account = accountFor()
    account.acceptVoiceConsent(VoiceConsent.create({ version: '2026-08-15', acceptedAt: NOW }))

    await expect(
      createUseCase(account).execute({ accessToken: 'access-token' }),
    ).resolves.toMatchObject({
      consent: {
        purpose: 'voice_recording_and_analysis',
        version: '2026-08-15',
        acceptedAt: NOW.toISOString(),
      },
    })
  })

  it('answers not found when the identity has no account of its own', async () => {
    await expect(
      createUseCase(accountFor('another-auth-user')).execute({ accessToken: 'access-token' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError)
  })

  it('answers not found once the deletion is scheduled', async () => {
    const account = accountFor()
    account.scheduleDeletion()

    await expect(
      createUseCase(account).execute({ accessToken: 'access-token' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError)
  })
})
