import { describe, expect, it } from 'vitest'

import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import { AuthProviderError } from '@/modules/accounts/domain/errors/auth-provider-error/index.js'

import { InMemoryAuthIdentityProviderAdapter } from './index.js'

const credentials = {
  email: 'person@example.com',
  password: 'Strong_password1!',
  captchaToken: 'captcha-token',
}

function createAdapter(): InMemoryAuthIdentityProviderAdapter {
  let id = 0
  return new InMemoryAuthIdentityProviderAdapter(
    { now: () => new Date('2026-08-15T12:00:00.000Z') },
    { generate: () => `generated-${(id += 1)}` },
  )
}

describe('InMemoryAuthIdentityProviderAdapter', () => {
  it('requires email confirmation before password sign-in', async () => {
    const adapter = createAdapter()

    await adapter.signUpWithPassword(credentials)

    await expect(adapter.signInWithPassword(credentials)).rejects.toMatchObject({
      code: 'accounts.EMAIL_NOT_CONFIRMED',
      context: { reason: 'email_unconfirmed' },
    })

    adapter.confirmEmail(credentials.email)
    await expect(adapter.signInWithPassword(credentials)).resolves.toMatchObject({
      identity: { email: credentials.email },
    })
  })

  it('invalidates the previous session when the same account signs in again', async () => {
    const adapter = createAdapter()
    await adapter.signUpWithPassword(credentials)
    adapter.confirmEmail(credentials.email)

    const first = await adapter.signInWithPassword(credentials)
    const second = await adapter.signInWithPassword(credentials)

    await expect(adapter.validateAccessToken(first.accessToken)).rejects.toBeInstanceOf(
      AuthenticationRejectedError,
    )
    await expect(adapter.validateAccessToken(second.accessToken)).resolves.toEqual(second.identity)
  })

  it('rotates a known refresh token and rejects it after use', async () => {
    const adapter = createAdapter()
    await adapter.signUpWithPassword(credentials)
    adapter.confirmEmail(credentials.email)
    const previous = await adapter.signInWithPassword(credentials)

    const refreshed = await adapter.refreshSession(previous.refreshToken)

    expect(refreshed.accessToken).not.toBe(previous.accessToken)
    expect(refreshed.refreshToken).not.toBe(previous.refreshToken)
    await expect(adapter.refreshSession(previous.refreshToken)).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'refresh_token_invalid' },
    })
  })

  it('keeps the session id across a refresh', async () => {
    const adapter = createAdapter()
    await adapter.signUpWithPassword(credentials)
    adapter.confirmEmail(credentials.email)
    const previous = await adapter.signInWithPassword(credentials)

    const refreshed = await adapter.refreshSession(previous.refreshToken)

    expect(refreshed.identity.sessionId).toBe(previous.identity.sessionId)
    await expect(adapter.validateAccessToken(refreshed.accessToken)).resolves.toMatchObject({
      sessionId: previous.identity.sessionId,
    })
  })

  it('completes Google OAuth only with a verified provider email', async () => {
    const adapter = createAdapter()
    adapter.registerGoogleCode('google-code', {
      authUserId: 'google-user-1',
      email: 'google@example.com',
      emailVerified: true,
    })

    const authorization = await adapter.createGoogleAuthorization('https://api.test/callback')
    const session = await adapter.exchangeGoogleCode('google-code', authorization.pkceState)

    expect(authorization.authorizationUrl).toContain('accounts.test/google')
    expect(session.identity).toMatchObject({
      authUserId: 'google-user-1',
      email: 'google@example.com',
    })
  })

  it('rejects Google identities whose email is not verified', async () => {
    const adapter = createAdapter()
    adapter.registerGoogleCode('google-code', {
      authUserId: 'google-user-1',
      email: 'google@example.com',
      emailVerified: false,
    })
    const authorization = await adapter.createGoogleAuthorization('https://api.test/callback')

    await expect(
      adapter.exchangeGoogleCode('google-code', authorization.pkceState),
    ).rejects.toMatchObject({
      context: { reason: 'google_failed' },
    })
  })

  it('simulates provider failures without network calls', async () => {
    const adapter = createAdapter()
    const failure = new AuthProviderError()
    adapter.simulateFailure(failure)

    await expect(adapter.signUpWithPassword(credentials)).rejects.toBe(failure)
  })
})
