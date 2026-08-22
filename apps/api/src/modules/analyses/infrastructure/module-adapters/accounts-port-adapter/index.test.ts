import { describe, expect, it } from 'vitest'
import { AccountsPortAdapter } from './index.js'
describe('AccountsPortAdapter', () => {
  it('returns a snapshot plan and null when no snapshot exists', async () => {
    const adapter = new AccountsPortAdapter({
      getAccountSnapshot: () => Promise.resolve(null),
      authenticate: () => Promise.resolve({ accountId: null }),
    })
    await expect(adapter.findPlan('account-id')).resolves.toBeNull()
  })

  it('delegates identity resolution to the accounts facade', async () => {
    const accessToken = 'access-token'
    const adapter = new AccountsPortAdapter({
      getAccountSnapshot: () => Promise.resolve(null),
      authenticate: (receivedAccessToken: string) =>
        Promise.resolve({ accountId: receivedAccessToken === accessToken ? 'account-id' : null }),
    })

    await expect(adapter.resolveAccountId(accessToken)).resolves.toBe('account-id')
    await expect(adapter.resolveAccountId('unknown-token')).resolves.toBeNull()
  })
})
