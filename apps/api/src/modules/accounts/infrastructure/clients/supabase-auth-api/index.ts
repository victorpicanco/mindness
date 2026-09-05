import { createClient } from '@supabase/supabase-js'

import { AuthProviderError } from '@/modules/accounts/domain/errors/auth-provider-error/index.js'

export interface SupabaseAuthResult {
  readonly data: unknown
  readonly error: unknown
}

export interface SupabaseGoogleAuthorizationResult extends SupabaseAuthResult {
  readonly pkceState: string
}

export interface SupabaseAuthApi {
  signUp(params: {
    readonly email: string
    readonly password: string
    readonly captchaToken: string
  }): Promise<SupabaseAuthResult>
  signIn(params: {
    readonly email: string
    readonly password: string
    readonly captchaToken: string
  }): Promise<SupabaseAuthResult>
  createGoogleAuthorization(redirectTo: string): Promise<SupabaseGoogleAuthorizationResult>
  exchangeGoogleCode(code: string, pkceState: string): Promise<SupabaseAuthResult>
  refreshSession(refreshToken: string): Promise<SupabaseAuthResult>
  verifyOtp(tokenHash: string, type: 'email' | 'recovery'): Promise<SupabaseAuthResult>
  resendSignUpConfirmation(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<SupabaseAuthResult>
  requestPasswordRecovery(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<SupabaseAuthResult>
  updatePassword(authUserId: string, password: string): Promise<SupabaseAuthResult>
  getClaims(accessToken: string): Promise<SupabaseAuthResult>
  signOut(accessToken: string): Promise<{ readonly error: unknown }>
}

export interface SupabaseAuthConfig {
  readonly url: string
  readonly publishableKey: string
  readonly secretKey: string
  readonly emailRedirectUrl: string
}

export type SupabaseAuthClientFactory = (
  url: string,
  key: string,
  storage: SupabaseRequestStorage,
) => ReturnType<typeof createClient>

export class SupabaseRequestStorage {
  readonly isServer = true

  constructor(private readonly entries = new Map<string, string>()) {}

  static fromSerialized(serialized: string): SupabaseRequestStorage {
    const decoded: unknown = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8'))
    const entries = new Map<string, string>()

    if (Array.isArray(decoded)) {
      for (const entry of decoded) {
        if (!Array.isArray(entry)) continue
        const key: unknown = entry[0]
        const value: unknown = entry[1]
        if (typeof key === 'string' && typeof value === 'string') entries.set(key, value)
      }
    }

    return new SupabaseRequestStorage(entries)
  }

  serialize(): string {
    return Buffer.from(JSON.stringify([...this.entries]), 'utf8').toString('base64url')
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value)
  }

  removeItem(key: string): void {
    this.entries.delete(key)
  }
}

export class SupabaseAuthApiClient implements SupabaseAuthApi {
  constructor(
    private readonly config: SupabaseAuthConfig,
    private readonly createSupabaseClient: SupabaseAuthClientFactory = defaultClientFactory,
  ) {}

  signUp(params: {
    readonly email: string
    readonly password: string
    readonly captchaToken: string
  }): Promise<SupabaseAuthResult> {
    return this.client().auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        captchaToken: params.captchaToken,
        emailRedirectTo: this.config.emailRedirectUrl,
      },
    })
  }

  signIn(params: {
    readonly email: string
    readonly password: string
    readonly captchaToken: string
  }): Promise<SupabaseAuthResult> {
    return this.client().auth.signInWithPassword({
      email: params.email,
      password: params.password,
      options: { captchaToken: params.captchaToken },
    })
  }

  async createGoogleAuthorization(redirectTo: string): Promise<SupabaseGoogleAuthorizationResult> {
    const storage = new SupabaseRequestStorage()
    const result = await this.client(storage).auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    })

    return { data: result.data, error: result.error, pkceState: storage.serialize() }
  }

  exchangeGoogleCode(code: string, pkceState: string): Promise<SupabaseAuthResult> {
    let storage: SupabaseRequestStorage

    try {
      storage = SupabaseRequestStorage.fromSerialized(pkceState)
    } catch (error) {
      throw new AuthProviderError({ cause: error })
    }

    return this.client(storage).auth.exchangeCodeForSession(code)
  }

  refreshSession(refreshToken: string): Promise<SupabaseAuthResult> {
    return this.client().auth.refreshSession({ refresh_token: refreshToken })
  }

  verifyOtp(tokenHash: string, type: 'email' | 'recovery'): Promise<SupabaseAuthResult> {
    return this.client().auth.verifyOtp({ token_hash: tokenHash, type })
  }

  resendSignUpConfirmation(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<SupabaseAuthResult> {
    return this.client().auth.resend({
      type: 'signup',
      email: params.email,
      options: {
        captchaToken: params.captchaToken,
        emailRedirectTo: this.config.emailRedirectUrl,
      },
    })
  }

  requestPasswordRecovery(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<SupabaseAuthResult> {
    return this.client().auth.resetPasswordForEmail(params.email, {
      captchaToken: params.captchaToken,
      redirectTo: this.config.emailRedirectUrl,
    })
  }

  updatePassword(authUserId: string, password: string): Promise<SupabaseAuthResult> {
    return this.adminClient().auth.admin.updateUserById(authUserId, { password })
  }

  getClaims(accessToken: string): Promise<SupabaseAuthResult> {
    return this.client().auth.getClaims(accessToken)
  }

  signOut(accessToken: string): Promise<{ readonly error: unknown }> {
    return this.adminClient().auth.admin.signOut(accessToken, 'global')
  }

  // The secret key bypasses every project-side protection, so it is reserved for
  // `auth.admin.*`. Everything a signed-out visitor can reach runs on the
  // publishable key, which is what those endpoints are designed for.
  private client(storage: SupabaseRequestStorage = new SupabaseRequestStorage()) {
    return this.createSupabaseClient(this.config.url, this.config.publishableKey, storage)
  }

  private adminClient() {
    return this.createSupabaseClient(
      this.config.url,
      this.config.secretKey,
      new SupabaseRequestStorage(),
    )
  }
}

function defaultClientFactory(
  url: string,
  key: string,
  storage: SupabaseRequestStorage,
): ReturnType<typeof createClient> {
  return createClient(url, key, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  })
}
