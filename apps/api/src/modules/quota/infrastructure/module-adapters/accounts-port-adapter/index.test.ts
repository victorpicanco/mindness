import { describe, expect, it } from 'vitest'

import type { AccountsSnapshotReader } from './index.js'
import { AccountsPortAdapter } from './index.js'

const CREATED_AT = new Date('2026-08-15T00:00:00.000Z')

describe('AccountsPortAdapter', () => {
  it('translates the account snapshot into the quota vocabulary', async () => {
    const accountsFacade: AccountsSnapshotReader = {
      getAccountSnapshot: (accountId) =>
        Promise.resolve({
          accountId,
          plan: 'free',
          createdAt: CREATED_AT,
          timeZone: 'America/Sao_Paulo',
        }),
    }
    const adapter = new AccountsPortAdapter(accountsFacade)

    await expect(adapter.findAccount('account-1')).resolves.toEqual({
      accountId: 'account-1',
      plan: 'free',
      createdAt: CREATED_AT,
    })
  })

  it('returns null when the account facade cannot find the account', async () => {
    const accountsFacade: AccountsSnapshotReader = {
      getAccountSnapshot: () => Promise.resolve(null),
    }
    const adapter = new AccountsPortAdapter(accountsFacade)

    await expect(adapter.findAccount('missing-account')).resolves.toBeNull()
  })
})
