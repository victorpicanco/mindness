import { describe, expect, it } from 'vitest'

import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { GoogleAuthorization } from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'

import { StartGoogleSignInUseCase } from './index.js'

class StubGoogleAuthorizer {
  readonly requestedRedirects: string[] = []
  rejection: AuthenticationRejectedError | null = null

  createGoogleAuthorization(redirectTo: string): Promise<GoogleAuthorization> {
    if (this.rejection !== null) return Promise.reject(this.rejection)
    this.requestedRedirects.push(redirectTo)

    return Promise.resolve({
      authorizationUrl: 'https://accounts.google.com/oauth',
      pkceState: 'opaque-pkce-state',
    })
  }
}

function createHarness() {
  const authIdentityProvider = new StubGoogleAuthorizer()

  return {
    authIdentityProvider,
    useCase: new StartGoogleSignInUseCase({
      authIdentityProvider,
      googleCallbackUrl: 'https://api.test/accounts/auth/google/callback',
    }),
  }
}

describe('StartGoogleSignInUseCase', () => {
  it('authorizes against the callback the server owns, not one supplied by the caller', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute()).resolves.toEqual({
      authorizationUrl: 'https://accounts.google.com/oauth',
      pkceState: 'opaque-pkce-state',
    })

    expect(harness.authIdentityProvider.requestedRedirects).toEqual([
      'https://api.test/accounts/auth/google/callback',
    ])
  })

  it('propagates a provider rejection', async () => {
    const harness = createHarness()
    harness.authIdentityProvider.rejection = new AuthenticationRejectedError('google_failed')

    await expect(harness.useCase.execute()).rejects.toBeInstanceOf(AuthenticationRejectedError)
  })
})
