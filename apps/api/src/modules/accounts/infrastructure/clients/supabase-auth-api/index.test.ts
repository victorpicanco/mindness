import { createClient } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it } from 'vitest'

import {
  SupabaseAuthApiClient,
  SupabaseRequestStorage,
  type SupabaseAuthClientFactory,
} from './index.js'

const PUBLISHABLE_KEY = 'publishable-key'
const SECRET_KEY = 'secret-key'

let usedKeys: string[]

function stubFetch(): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify({}), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

function createSubject(): SupabaseAuthApiClient {
  const factory: SupabaseAuthClientFactory = (url, key, storage) => {
    usedKeys.push(key)

    return createClient(url, key, {
      auth: {
        storage,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce',
      },
      global: { fetch: stubFetch },
    })
  }

  return new SupabaseAuthApiClient(
    {
      url: 'http://supabase.invalid',
      publishableKey: PUBLISHABLE_KEY,
      secretKey: SECRET_KEY,
      emailRedirectUrl: 'http://localhost:3000/auth/confirm',
    },
    factory,
  )
}

describe('SupabaseAuthApiClient', () => {
  beforeEach(() => {
    usedKeys = []
  })

  describe('end-user flows', () => {
    it('signs up with the publishable key', async () => {
      await createSubject().signUp({
        email: 'user@example.com',
        password: 'Password1!',
        captchaToken: 'captcha',
      })

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })

    it('signs in with the publishable key', async () => {
      await createSubject().signIn({
        email: 'user@example.com',
        password: 'Password1!',
        captchaToken: 'captcha',
      })

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })

    it('creates a google authorization with the publishable key', async () => {
      await createSubject().createGoogleAuthorization('http://localhost:3333/auth/google/callback')

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })

    it('exchanges a google code with the publishable key', async () => {
      const pkceState = new SupabaseRequestStorage().serialize()

      await createSubject().exchangeGoogleCode('code', pkceState)

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })

    it('refreshes a session with the publishable key', async () => {
      await createSubject().refreshSession('refresh-token')

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })

    it('verifies an otp with the publishable key', async () => {
      await createSubject().verifyOtp('token-hash', 'email')

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })

    it('resends a sign-up confirmation with the publishable key', async () => {
      await createSubject().resendSignUpConfirmation({
        email: 'user@example.com',
        captchaToken: 'captcha',
      })

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })

    it('requests a password recovery with the publishable key', async () => {
      await createSubject().requestPasswordRecovery({
        email: 'user@example.com',
        captchaToken: 'captcha',
      })

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })

    it('reads claims with the publishable key', async () => {
      await createSubject().getClaims('access-token')

      expect(usedKeys).toEqual([PUBLISHABLE_KEY])
    })
  })

  describe('admin flows', () => {
    it('updates a password with the secret key', async () => {
      await createSubject().updatePassword('3f1c8b2e-9d4a-4f7b-8c15-2a6e0b7d9f34', 'Password1!')

      expect(usedKeys).toEqual([SECRET_KEY])
    })

    it('signs a user out with the secret key', async () => {
      await createSubject().signOut('access-token')

      expect(usedKeys).toEqual([SECRET_KEY])
    })
  })

  it('never reaches for the secret key on an end-user flow', async () => {
    const subject = createSubject()

    await subject.signUp({
      email: 'user@example.com',
      password: 'Password1!',
      captchaToken: 'captcha',
    })
    await subject.signIn({
      email: 'user@example.com',
      password: 'Password1!',
      captchaToken: 'captcha',
    })
    await subject.refreshSession('refresh-token')

    expect(usedKeys).not.toContain(SECRET_KEY)
  })
})
