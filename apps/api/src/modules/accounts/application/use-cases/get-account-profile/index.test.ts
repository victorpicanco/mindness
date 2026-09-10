import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import { AccountNotFoundError } from '@/modules/accounts/domain/errors/account-not-found-error/index.js'
import type { VerifiedAuthIdentity } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { DisplayName } from '@/modules/accounts/domain/value-objects/display-name/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'

import { GetAccountProfileUseCase } from './index.js'

const NOW = new Date('2026-08-15T12:00:00.000Z')

function accountFor(authUserId = 'auth-user-1'): Account {
  return Account.createRegistered({
    id: 'account-1',
    email: EmailAddress.create('person@example.com'),
    authUserId,
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: NOW,
  })
}

function guestAccountFor(authUserId = 'auth-user-1'): Account {
  return Account.createGuest({
    id: 'account-1',
    authUserId,
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: NOW,
  })
}

class InMemoryAccountsRepository implements AccountsRepository {
  constructor(private readonly existing: Account | null = null) {}

  findById(accountId: string): Promise<Account | null> {
    return Promise.resolve(this.existing?.id === accountId ? this.existing : null)
  }

  findByAuthUserId(authUserId: string): Promise<Account | null> {
    return Promise.resolve(this.existing?.authUserId === authUserId ? this.existing : null)
  }

  findByEmail(email: string): Promise<Account | null> {
    return Promise.resolve(this.existing?.email?.value === email ? this.existing : null)
  }

  save(): Promise<void> {
    return Promise.resolve()
  }
}

function identityProviderFor(authenticationMethod: 'password' | 'anonymous') {
  return {
    validateAccessToken(): Promise<VerifiedAuthIdentity> {
      const identityFields = {
        authUserId: 'auth-user-1',
        sessionId: 'session-1',
        issuedAt: NOW,
      }
      return Promise.resolve(
        authenticationMethod === 'anonymous'
          ? { ...identityFields, email: null, authenticationMethod }
          : { ...identityFields, email: 'person@example.com', authenticationMethod },
      )
    },
  }
}

function createUseCase(
  existing: Account | null = null,
  authenticationMethod: 'password' | 'anonymous' = 'password',
): GetAccountProfileUseCase {
  return new GetAccountProfileUseCase({
    accounts: new InMemoryAccountsRepository(existing),
    authIdentityProvider: identityProviderFor(authenticationMethod),
  })
}

describe('GetAccountProfileUseCase', () => {
  it('returns the profile of the account behind the validated identity', async () => {
    await expect(
      createUseCase(accountFor()).execute({ accessToken: 'access-token' }),
    ).resolves.toEqual({
      accountId: 'account-1',
      accountKind: 'registered',
      authenticationMethod: 'password',
      createdAt: NOW.toISOString(),
      email: 'person@example.com',
      name: null,
      timeZone: 'America/Sao_Paulo',
      plan: 'free',
      consent: null,
    })
  })

  it('describes a guest account as such and without an email address', async () => {
    await expect(
      createUseCase(guestAccountFor(), 'anonymous').execute({ accessToken: 'access-token' }),
    ).resolves.toEqual({
      accountId: 'account-1',
      accountKind: 'guest',
      authenticationMethod: 'anonymous',
      createdAt: NOW.toISOString(),
      email: null,
      name: null,
      timeZone: 'America/Sao_Paulo',
      plan: 'free',
      consent: null,
    })
  })

  it('rejects a permanent identity attached to a guest account', async () => {
    await expect(
      createUseCase(guestAccountFor(), 'password').execute({ accessToken: 'access-token' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError)
  })

  it('rejects an anonymous identity attached to a registered account', async () => {
    await expect(
      createUseCase(accountFor(), 'anonymous').execute({ accessToken: 'access-token' }),
    ).rejects.toBeInstanceOf(AccountNotFoundError)
  })

  it('exposes the name of an account that has one', async () => {
    const account = accountFor()
    account.changeName(DisplayName.create('Maria Silva'))

    await expect(
      createUseCase(account).execute({ accessToken: 'access-token' }),
    ).resolves.toMatchObject({ name: 'Maria Silva' })
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
