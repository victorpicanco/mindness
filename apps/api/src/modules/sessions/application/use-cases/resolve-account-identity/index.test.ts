import { describe, expect, it } from 'vitest'

import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

import { ResolveAccountIdentityUseCase } from './index.js'
import type { ResolveAccountIdentityDependencies } from './types.js'

class FakeAccountsError extends ConflictError {
  readonly code = 'accounts.AUTHENTICATION_REJECTED'
}

describe('ResolveAccountIdentityUseCase', () => {
  it('returns the accountId resolved by the accounts port', async () => {
    const dependencies: ResolveAccountIdentityDependencies = {
      accounts: { resolveAccountId: () => Promise.resolve('account-1') },
    }
    const useCase = new ResolveAccountIdentityUseCase(dependencies)

    await expect(useCase.execute({ accessToken: 'token-1' })).resolves.toEqual({
      accountId: 'account-1',
    })
  })

  it('returns a null accountId when the token has no linked domain account', async () => {
    const dependencies: ResolveAccountIdentityDependencies = {
      accounts: { resolveAccountId: () => Promise.resolve(null) },
    }
    const useCase = new ResolveAccountIdentityUseCase(dependencies)

    await expect(useCase.execute({ accessToken: 'token-1' })).resolves.toEqual({
      accountId: null,
    })
  })

  it('propagates an error raised by the accounts port without translation', async () => {
    const error = new FakeAccountsError('rejected')
    const dependencies: ResolveAccountIdentityDependencies = {
      accounts: { resolveAccountId: () => Promise.reject(error) },
    }
    const useCase = new ResolveAccountIdentityUseCase(dependencies)

    await expect(useCase.execute({ accessToken: 'token-1' })).rejects.toBe(error)
  })
})
