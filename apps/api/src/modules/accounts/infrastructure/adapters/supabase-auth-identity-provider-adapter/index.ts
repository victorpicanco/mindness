import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { AuthenticationRejectionReason } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import { AuthProviderError } from '@/modules/accounts/domain/errors/auth-provider-error/index.js'
import type {
  AuthIdentityProvider,
  AuthSession,
  AuthenticationMethod,
  GoogleAuthorization,
  SignInWithPasswordParams,
  SignUpWithPasswordParams,
  VerifiedAuthIdentity,
} from '@/modules/accounts/domain/ports/auth-identity-provider/index.js'
import type { SupabaseAuthApi } from '@/modules/accounts/infrastructure/clients/supabase-auth-api/index.js'

interface SupabaseSessionTokens {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: Date
}

const REJECTION_REASON_BY_PROVIDER_CODE = new Map<string, AuthenticationRejectionReason>([
  ['email_not_confirmed', 'email_unconfirmed'],
  ['invalid_credentials', 'invalid_credentials'],
  ['weak_password', 'weak_password'],
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function readEpochSeconds(source: Record<string, unknown>, key: string): Date | null {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : null
}

function providerErrorCode(error: unknown): string | null {
  return isRecord(error) ? readString(error, 'code') : null
}

function readAuthenticationMethod(claims: Record<string, unknown>): AuthenticationMethod | null {
  const references = claims.amr
  if (!Array.isArray(references)) return null

  for (const reference of references) {
    if (!isRecord(reference)) continue
    const method = readString(reference, 'method')
    if (method === 'password') return 'password'
    if (method === 'oauth') return 'google'
  }

  return null
}

function rejectionFrom(error: unknown, fallback: AuthenticationRejectionReason): never {
  const code = providerErrorCode(error)
  const reason =
    code === null ? fallback : (REJECTION_REASON_BY_PROVIDER_CODE.get(code) ?? fallback)

  throw new AuthenticationRejectedError(reason, { cause: error })
}

function readSessionTokens(data: unknown): SupabaseSessionTokens | null {
  if (!isRecord(data)) return null
  const session = data.session
  if (!isRecord(session)) return null

  const accessToken = readString(session, 'access_token')
  const refreshToken = readString(session, 'refresh_token')
  const expiresAt = readEpochSeconds(session, 'expires_at')
  if (accessToken === null || refreshToken === null || expiresAt === null) return null

  return { accessToken, refreshToken, expiresAt }
}

function readIdentity(data: unknown): VerifiedAuthIdentity | null {
  if (!isRecord(data)) return null
  const claims = data.claims
  if (!isRecord(claims)) return null

  const authUserId = readString(claims, 'sub')
  const email = readString(claims, 'email')
  const sessionId = readString(claims, 'session_id')
  const issuedAt = readEpochSeconds(claims, 'iat')
  const authenticationMethod = readAuthenticationMethod(claims)
  if (
    authUserId === null ||
    email === null ||
    sessionId === null ||
    issuedAt === null ||
    authenticationMethod === null
  ) {
    return null
  }

  return { authUserId, email, sessionId, issuedAt, authenticationMethod }
}

export class SupabaseAuthIdentityProviderAdapter implements AuthIdentityProvider {
  constructor(private readonly api: SupabaseAuthApi) {}

  async signUpWithPassword(params: SignUpWithPasswordParams): Promise<void> {
    const result = await this.call(() => this.api.signUp(params))
    if (result.error !== null) rejectionFrom(result.error, 'weak_password')
  }

  async signInWithPassword(params: SignInWithPasswordParams): Promise<AuthSession> {
    const result = await this.call(() => this.api.signIn(params))
    if (result.error !== null) rejectionFrom(result.error, 'invalid_credentials')

    return this.sessionFrom(result.data, 'invalid_credentials')
  }

  async createGoogleAuthorization(redirectTo: string): Promise<GoogleAuthorization> {
    const result = await this.call(() => this.api.createGoogleAuthorization(redirectTo))
    if (result.error !== null) rejectionFrom(result.error, 'google_failed')

    const authorizationUrl = isRecord(result.data) ? readString(result.data, 'url') : null
    if (authorizationUrl === null) {
      throw new AuthenticationRejectedError('google_failed')
    }

    return { authorizationUrl, pkceState: result.pkceState }
  }

  async exchangeGoogleCode(code: string, pkceState: string): Promise<AuthSession> {
    const result = await this.call(() => this.api.exchangeGoogleCode(code, pkceState))
    if (result.error !== null) rejectionFrom(result.error, 'google_failed')

    return this.sessionFrom(result.data, 'google_failed')
  }

  async validateAccessToken(accessToken: string): Promise<VerifiedAuthIdentity> {
    const identity = await this.readIdentityFor(accessToken)
    if (identity === null) throw new AuthenticationRejectedError('invalid_token')

    return identity
  }

  async revokeSession(accessToken: string): Promise<void> {
    const result = await this.call(() => this.api.signOut(accessToken))
    if (result.error !== null) {
      throw new AuthProviderError({ cause: result.error })
    }
  }

  private async sessionFrom(
    data: unknown,
    rejectionReason: AuthenticationRejectionReason,
  ): Promise<AuthSession> {
    const tokens = readSessionTokens(data)
    if (tokens === null) throw new AuthenticationRejectedError(rejectionReason)

    const identity = await this.readIdentityFor(tokens.accessToken)
    if (identity === null) throw new AuthenticationRejectedError(rejectionReason)

    return { ...tokens, identity }
  }

  private async readIdentityFor(accessToken: string): Promise<VerifiedAuthIdentity | null> {
    const result = await this.call(() => this.api.getClaims(accessToken))

    return result.error === null ? readIdentity(result.data) : null
  }

  private async call<T extends { readonly error: unknown }>(
    operation: () => Promise<T>,
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      throw new AuthProviderError({ cause: error })
    }
  }
}
