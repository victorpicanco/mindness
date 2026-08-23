import { describe, expect, it } from 'vitest'

import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

import type { AccountsIdentityReader } from './index.js'
import { AccountsPortAdapter } from './index.js'

class FakeAccountsError extends ConflictError {
  readonly code = 'accounts.AUTHENTICATION_REJECTED'
}

describe('AccountsPortAdapter', () => {
  it('resolves the accountId returned by the accounts facade', async () => {
    const accountsFacade: AccountsIdentityReader = {
      authenticate: () => Promise.resolve({ accountId: 'account-1' }),
      getAccountSnapshot: () => Promise.resolve(null),
    }
    const adapter = new AccountsPortAdapter(accountsFacade)

    await expect(adapter.resolveAccountId('token-1')).resolves.toBe('account-1')
  })

  it('resolves null when the token is valid but has no linked domain account', async () => {
    const accountsFacade: AccountsIdentityReader = {
      authenticate: () => Promise.resolve({ accountId: null }),
      getAccountSnapshot: () => Promise.resolve(null),
    }
    const adapter = new AccountsPortAdapter(accountsFacade)

    await expect(adapter.resolveAccountId('token-1')).resolves.toBeNull()
  })

  it('propagates an error raised by the accounts facade without translation', async () => {
    const error = new FakeAccountsError('rejected')
    const accountsFacade: AccountsIdentityReader = {
      authenticate: () => Promise.reject(error),
      getAccountSnapshot: () => Promise.resolve(null),
    }
    const adapter = new AccountsPortAdapter(accountsFacade)

    await expect(adapter.resolveAccountId('token-1')).rejects.toBe(error)
  })

  it('translates the account snapshot into a profile with plan and time zone', async () => {
    const accountsFacade: AccountsIdentityReader = {
      authenticate: () => Promise.resolve({ accountId: null }),
      getAccountSnapshot: () =>
        Promise.resolve({
          accountId: 'account-1',
          plan: 'free',
          createdAt: new Date('2026-08-22T00:00:00.000Z'),
          timeZone: 'America/Sao_Paulo',
        }),
    }
    const adapter = new AccountsPortAdapter(accountsFacade)

    await expect(adapter.findProfile('account-1')).resolves.toStrictEqual({
      plan: 'free',
      timeZone: 'America/Sao_Paulo',
    })
  })

  it('resolves null when the account snapshot does not exist', async () => {
    const accountsFacade: AccountsIdentityReader = {
      authenticate: () => Promise.resolve({ accountId: null }),
      getAccountSnapshot: () => Promise.resolve(null),
    }
    const adapter = new AccountsPortAdapter(accountsFacade)

    await expect(adapter.findProfile('missing-account')).resolves.toBeNull()
  })
})
