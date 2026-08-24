import { createClient } from '@supabase/supabase-js'
import { describe, expect, it } from 'vitest'

import { SupabaseAuthIdentityProviderAdapter } from '@/modules/accounts/infrastructure/adapters/supabase-auth-identity-provider-adapter/index.js'
import { SupabaseAuthApiClient } from '@/modules/accounts/infrastructure/clients/supabase-auth-api/index.js'

const url = process.env.SUPABASE_PROVIDER_URL
const secretKey = process.env.SUPABASE_PROVIDER_SECRET_KEY
const configured = url !== undefined && secretKey !== undefined

describe.skipIf(!configured)('Supabase email confirmation provider', () => {
  it('exchanges a real generated token hash once', async () => {
    if (url === undefined || secretKey === undefined) return

    const admin = createClient(url, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    const email = `provider-confirmation-${crypto.randomUUID()}@example.com`
    const generated = await admin.auth.admin.generateLink({
      type: 'signup',
      email,
      password: 'Provider_password1!',
      options: { redirectTo: 'http://localhost:3000/auth/confirm' },
    })
    expect(generated.error).toBeNull()
    const userId = generated.data.user?.id
    const tokenHash = generated.data.properties?.hashed_token
    expect(userId).toBeTypeOf('string')
    expect(tokenHash).toBeTypeOf('string')
    if (userId === undefined || tokenHash === undefined) return

    const adapter = new SupabaseAuthIdentityProviderAdapter(
      new SupabaseAuthApiClient({
        url,
        secretKey,
        emailRedirectUrl: 'http://localhost:3000/auth/confirm',
      }),
    )

    try {
      await expect(adapter.verifyEmailOtp(tokenHash, 'email')).resolves.toMatchObject({
        identity: { authUserId: userId, email },
      })
      await expect(adapter.verifyEmailOtp(tokenHash, 'email')).rejects.toMatchObject({
        context: { reason: 'email_link_invalid' },
      })
    } finally {
      await admin.auth.admin.deleteUser(userId)
    }
  })
})
