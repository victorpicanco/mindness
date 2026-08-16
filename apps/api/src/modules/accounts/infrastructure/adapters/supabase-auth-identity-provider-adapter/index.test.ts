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
})
