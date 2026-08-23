import { describe, expect, it } from 'vitest'

import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type {
  AuthSession,
  RefreshTokenAuthenticator,
} from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import { RefreshSessionUseCase } from './index.js'

class StubRefreshTokenAuthenticator implements RefreshTokenAuthenticator {
  readonly refreshTokens: string[] = []
  rejection: AuthenticationRejectedError | null = null

  refreshSession(refreshToken: string): Promise<AuthSession> {
    this.refreshTokens.push(refreshToken)
    if (this.rejection !== null) return Promise.reject(this.rejection)

    return Promise.resolve({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: new Date('2026-08-15T13:00:00.000Z'),
      identity: {
        authUserId: 'auth-user-1',
        email: 'person@example.com',
        sessionId: 'session-2',
        issuedAt: new Date('2026-08-15T12:00:00.000Z'),
        authenticationMethod: 'password',
      },
    })
  }
}

describe('RefreshSessionUseCase', () => {
  it('returns the refreshed session tokens', async () => {
    const authIdentityProvider = new StubRefreshTokenAuthenticator()
    const useCase = new RefreshSessionUseCase({ authIdentityProvider })

    await expect(useCase.execute({ refreshToken: 'current-refresh-token' })).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
      expiresAt: '2026-08-15T13:00:00.000Z',
    })
    expect(authIdentityProvider.refreshTokens).toEqual(['current-refresh-token'])
  })

  it('propagates an invalid refresh token rejection', async () => {
    const authIdentityProvider = new StubRefreshTokenAuthenticator()
    authIdentityProvider.rejection = new AuthenticationRejectedError('refresh_token_invalid')
    const useCase = new RefreshSessionUseCase({ authIdentityProvider })

    await expect(useCase.execute({ refreshToken: 'expired-refresh-token' })).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'refresh_token_invalid' },
    })
  })
})
