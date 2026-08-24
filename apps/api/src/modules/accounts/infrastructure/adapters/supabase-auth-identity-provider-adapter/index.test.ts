import { describe, expect, it } from 'vitest'

import type {
  SupabaseAuthApi,
  SupabaseAuthResult,
} from '@/modules/accounts/infrastructure/clients/supabase-auth-api/index.js'

import { SupabaseAuthIdentityProviderAdapter } from './index.js'

const claims = {
  sub: 'auth-user-1',
  email: 'person@example.com',
  session_id: 'session-1',
  iat: 1_786_795_200,
  amr: [{ method: 'password', timestamp: 1_786_795_200 }],
}

class FakeSupabaseAuthApi implements SupabaseAuthApi {
  signUpResult: SupabaseAuthResult = { data: {}, error: null }
  signInResult: SupabaseAuthResult = {
    data: {
      session: {
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        expires_at: 1_786_798_800,
      },
    },
    error: null,
  }
  googleResult: SupabaseAuthResult = this.signInResult
  refreshResult: SupabaseAuthResult = this.signInResult
  verifyOtpResult: SupabaseAuthResult = this.signInResult
  resendResult: SupabaseAuthResult = { data: {}, error: null }
  recoveryResult: SupabaseAuthResult = { data: {}, error: null }
  updatePasswordResult: SupabaseAuthResult = { data: {}, error: null }
  claimsResult: SupabaseAuthResult = { data: { claims }, error: null }
  readonly calls: string[] = []

  signUp(): Promise<SupabaseAuthResult> {
    this.calls.push('sign-up')
    return Promise.resolve(this.signUpResult)
  }

  signIn(): Promise<SupabaseAuthResult> {
    this.calls.push('sign-in')
    return Promise.resolve(this.signInResult)
  }

  createGoogleAuthorization() {
    this.calls.push('google-start')
    return Promise.resolve({
      data: { url: 'https://accounts.google.com/oauth' },
      error: null,
      pkceState: 'opaque-pkce-state',
    })
  }

  exchangeGoogleCode(): Promise<SupabaseAuthResult> {
    this.calls.push('google-callback')
    return Promise.resolve(this.googleResult)
  }

  refreshSession(): Promise<SupabaseAuthResult> {
    this.calls.push('refresh-session')
    return Promise.resolve(this.refreshResult)
  }

  verifyOtp(): Promise<SupabaseAuthResult> {
    this.calls.push('verify-otp')
    return Promise.resolve(this.verifyOtpResult)
  }

  resendSignUpConfirmation(): Promise<SupabaseAuthResult> {
    this.calls.push('resend-sign-up')
    return Promise.resolve(this.resendResult)
  }

  requestPasswordRecovery(): Promise<SupabaseAuthResult> {
    this.calls.push('request-recovery')
    return Promise.resolve(this.recoveryResult)
  }

  updatePassword(): Promise<SupabaseAuthResult> {
    this.calls.push('update-password')
    return Promise.resolve(this.updatePasswordResult)
  }

  getClaims(): Promise<SupabaseAuthResult> {
    this.calls.push('get-claims')
    return Promise.resolve(this.claimsResult)
  }

  signOut(): Promise<{ readonly error: unknown }> {
    this.calls.push('sign-out')
    return Promise.resolve({ error: null })
  }
}

const credentials = {
  email: 'person@example.com',
  password: 'Strong_password1!',
  captchaToken: 'captcha-token',
}

describe('SupabaseAuthIdentityProviderAdapter', () => {
  it('creates password users and translates provider failures', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await expect(adapter.signUpWithPassword(credentials)).resolves.toBeUndefined()

    api.signUpResult = { data: null, error: { code: 'weak_password' } }
    await expect(adapter.signUpWithPassword(credentials)).rejects.toMatchObject({
      code: 'accounts.INVALID_ACCOUNT_VALUE',
      context: { field: 'password' },
    })
  })

  it('translates a rejected captcha on sign-up', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    api.signUpResult = { data: null, error: { code: 'captcha_failed' } }

    await expect(adapter.signUpWithPassword(credentials)).rejects.toMatchObject({
      code: 'accounts.CAPTCHA_REJECTED',
      httpStatus: 400,
    })
  })

  it('translates a rejected captcha on sign-in', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    api.signInResult = { data: null, error: { code: 'captcha_failed' } }

    await expect(adapter.signInWithPassword(credentials)).rejects.toMatchObject({
      code: 'accounts.CAPTCHA_REJECTED',
      httpStatus: 400,
    })
  })

  it('returns a session only after validating its Supabase claims', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await expect(adapter.signInWithPassword(credentials)).resolves.toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresAt: new Date('2026-08-15T13:00:00.000Z'),
      identity: {
        authUserId: 'auth-user-1',
        email: 'person@example.com',
        issuedAt: new Date('2026-08-15T12:00:00.000Z'),
        sessionId: 'session-1',
        authenticationMethod: 'password',
      },
    })
    expect(api.calls).toEqual(['sign-in', 'get-claims'])
  })

  it('refreshes a session and translates an invalid refresh token', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await expect(adapter.refreshSession('refresh-token')).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    expect(api.calls).toEqual(['refresh-session', 'get-claims'])

    api.refreshResult = { data: null, error: { code: 'refresh_token_not_found' } }
    await expect(adapter.refreshSession('invalid-refresh-token')).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'refresh_token_invalid' },
    })
  })

  it('round-trips the opaque PKCE state through Google OAuth', async () => {
    const api = new FakeSupabaseAuthApi()
    api.claimsResult = {
      data: { claims: { ...claims, amr: [{ method: 'oauth', timestamp: 1_786_795_200 }] } },
      error: null,
    }
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    const authorization = await adapter.createGoogleAuthorization('https://api.test/callback')
    const session = await adapter.exchangeGoogleCode('authorization-code', authorization.pkceState)

    expect(authorization).toEqual({
      authorizationUrl: 'https://accounts.google.com/oauth',
      pkceState: 'opaque-pkce-state',
    })
    expect(session.identity.authenticationMethod).toBe('google')
    expect(api.calls).toEqual(['google-start', 'google-callback', 'get-claims'])
  })

  it('rejects a token whose required claims are missing', async () => {
    const api = new FakeSupabaseAuthApi()
    api.claimsResult = { data: { claims: { sub: 'auth-user-1' } }, error: null }
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await expect(adapter.validateAccessToken('invalid-token')).rejects.toMatchObject({
      code: 'accounts.AUTHENTICATION_REJECTED',
      context: { reason: 'invalid_token' },
    })
  })

  it('revokes the session through the provider', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await adapter.revokeSession('access-token')

    expect(api.calls).toEqual(['sign-out'])
  })

  it('verifies a server-side email token hash and validates the returned session', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await expect(adapter.verifyEmailOtp('token-hash', 'email')).resolves.toMatchObject({
      accessToken: 'access-token',
      identity: { email: 'person@example.com' },
    })
    expect(api.calls).toEqual(['verify-otp', 'get-claims'])

    api.verifyOtpResult = { data: null, error: { code: 'otp_expired' } }
    await expect(adapter.verifyEmailOtp('expired-token', 'email')).rejects.toMatchObject({
      context: { reason: 'email_link_invalid' },
    })
  })

  it('attributes signup and recovery OTP sessions to the password flow', async () => {
    const api = new FakeSupabaseAuthApi()
    api.claimsResult = {
      data: { claims: { ...claims, amr: [{ method: 'email/signup', timestamp: 1_786_795_200 }] } },
      error: null,
    }
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await expect(adapter.verifyEmailOtp('token-hash', 'email')).resolves.toMatchObject({
      identity: { authenticationMethod: 'password' },
    })
  })

  it('resends confirmation and requests recovery with captcha protection', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await adapter.resendSignUpConfirmation({
      email: credentials.email,
      captchaToken: credentials.captchaToken,
    })
    await adapter.requestPasswordRecovery({
      email: credentials.email,
      captchaToken: credentials.captchaToken,
    })

    expect(api.calls).toEqual(['resend-sign-up', 'request-recovery'])
  })

  it('updates a password through the verified identity', async () => {
    const api = new FakeSupabaseAuthApi()
    const adapter = new SupabaseAuthIdentityProviderAdapter(api)

    await adapter.updatePassword('auth-user-1', 'New_password1!')

    expect(api.calls).toEqual(['update-password'])
  })
})
