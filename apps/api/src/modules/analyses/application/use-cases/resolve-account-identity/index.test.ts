import { describe, expect, it } from 'vitest'

import { ResolveAccountIdentityUseCase } from './index.js'

describe('ResolveAccountIdentityUseCase', () => {
  it('returns the account id for a known access token', async () => {
    const useCase = new ResolveAccountIdentityUseCase({
      accounts: { resolveAccountId: () => Promise.resolve('account-id') },
    })

    await expect(useCase.execute({ accessToken: 'known-token' })).resolves.toEqual({
      accountId: 'account-id',
    })
  })

  it('returns null for an unknown access token', async () => {
    const useCase = new ResolveAccountIdentityUseCase({
      accounts: { resolveAccountId: () => Promise.resolve(null) },
    })

    await expect(useCase.execute({ accessToken: 'unknown-token' })).resolves.toEqual({
      accountId: null,
    })
  })
})
