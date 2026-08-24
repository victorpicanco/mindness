import { describe, expect, it } from 'vitest'

import type { AuthSession } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import { ConfirmEmailUseCase } from './index.js'

const session: AuthSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date('2026-08-15T13:00:00.000Z'),
  identity: {
    authUserId: 'auth-user-1',
    email: 'person@example.com',
    sessionId: 'session-1',
    issuedAt: new Date('2026-08-15T12:00:00.000Z'),
    authenticationMethod: 'password',
  },
}

describe('ConfirmEmailUseCase', () => {
  it('exchanges the token hash for serializable session tokens', async () => {
    const calls: string[] = []
    const useCase = new ConfirmEmailUseCase({
      authIdentityProvider: {
        verifyEmailOtp: (tokenHash, type) => {
          calls.push(`${type}:${tokenHash}`)
          return Promise.resolve(session)
        },
      },
    })

    await expect(useCase.execute({ tokenHash: 'token-hash', type: 'email' })).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: '2026-08-15T13:00:00.000Z',
    })
    expect(calls).toEqual(['email:token-hash'])
  })
})
