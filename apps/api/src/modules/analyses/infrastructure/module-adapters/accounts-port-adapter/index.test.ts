import { describe, expect, it } from 'vitest'
import { AccountsPortAdapter } from './index.js'
describe('AccountsPortAdapter', () => {
  it('returns a snapshot plan and null when no snapshot exists', async () => {
    const adapter = new AccountsPortAdapter({ getAccountSnapshot: () => Promise.resolve(null) })
    await expect(adapter.findPlan('account-id')).resolves.toBeNull()
  })
})
