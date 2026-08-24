import { describe, expect, it } from 'vitest'

import { SignOutUseCase } from './index.js'

describe('SignOutUseCase', () => {
  it('globally revokes the current session', async () => {
    const revoked: string[] = []
    const useCase = new SignOutUseCase({
      authIdentityProvider: {
        revokeSession: (accessToken) => {
          revoked.push(accessToken)
          return Promise.resolve()
        },
      },
    })

    await expect(useCase.execute({ accessToken: 'access-token' })).resolves.toEqual({
      message: 'Session ended',
    })
    expect(revoked).toEqual(['access-token'])
  })
})
