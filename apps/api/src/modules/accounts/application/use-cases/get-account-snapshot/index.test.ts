import { describe, expect, it } from 'vitest'

import { Account } from '@/modules/accounts/domain/entities/account/index.js'
import type { AccountsRepository } from '@/modules/accounts/domain/repositories/accounts-repository/index.js'
import { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'

import { GetAccountSnapshotUseCase } from './index.js'

const CREATED_AT = new Date('2026-08-15T00:00:00.000Z')

class InMemoryAccountsRepository implements AccountsRepository {
  constructor(private readonly account: Account | null) {}

  count(): Promise<number> {
    return Promise.resolve(this.account === null ? 0 : 1)
  }

  findById(accountId: string): Promise<Account | null> {
    return Promise.resolve(this.account?.id === accountId ? this.account : null)
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

function createAccount(): Account {
  return Account.create({
    id: 'account-1',
    email: EmailAddress.create('person@example.com'),
    authUserId: 'auth-user-1',
    timeZone: TimeZone.create('America/Sao_Paulo'),
    createdAt: CREATED_AT,
  })
}

describe('GetAccountSnapshotUseCase', () => {
  it('returns only the account data required by consumers', async () => {
    const useCase = new GetAccountSnapshotUseCase(new InMemoryAccountsRepository(createAccount()))

    await expect(useCase.execute({ accountId: 'account-1' })).resolves.toEqual({
      accountId: 'account-1',
      plan: 'free',
      createdAt: CREATED_AT,
      timeZone: 'America/Sao_Paulo',
    })
  })

  it('returns null when the account does not exist', async () => {
    const useCase = new GetAccountSnapshotUseCase(new InMemoryAccountsRepository(null))

    await expect(useCase.execute({ accountId: 'missing-account' })).resolves.toBeNull()
  })
})
