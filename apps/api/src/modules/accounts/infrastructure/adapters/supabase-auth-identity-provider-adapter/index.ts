import { AccountAlreadyExistsError } from '@/modules/accounts/domain/errors/account-already-exists-error/index.js'
import { AccountBlockedError } from '@/modules/accounts/domain/errors/account-blocked-error/index.js'
import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import { EmailNotConfirmedError } from '@/modules/accounts/domain/errors/email-not-confirmed-error/index.js'
import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'
import type { AuthenticationRejectionReason } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import { AuthProviderError } from '@/modules/accounts/domain/errors/auth-provider-error/index.js'
import { CaptchaRejectedError } from '@/modules/accounts/domain/errors/captcha-rejected-error/index.js'
import { RateLimitedError } from '@/modules/accounts/domain/errors/rate-limited-error/index.js'
import { SignUpNotAllowedError } from '@/modules/accounts/domain/errors/sign-up-not-allowed-error/index.js'
import type {
  AuthIdentityProvider,
  AuthSession,
  AuthenticationMethod,
  EmailOtpVerificationType,
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
  ['invalid_credentials', 'invalid_credentials'],
])

const INVALID_REFRESH_TOKEN_CODES = new Set([
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_not_found',
  'session_expired',
])

const INVALID_ACCESS_TOKEN_CODES = new Set([
  'bad_jwt',
  'no_authorization',
  'session_not_found',
  'session_expired',
])

const INVALID_ACCESS_TOKEN_ERROR_NAMES = new Set(['AuthInvalidJwtError', 'AuthSessionMissingError'])

const ERROR_BY_PROVIDER_CODE = new Map<string, (cause: unknown) => never>([
  [
    'captcha_failed',
    (cause) => {
      throw new CaptchaRejectedError({ cause })
    },
  ],
  [
    'over_request_rate_limit',
    (cause) => {
      throw new RateLimitedError('authentication', { cause })
    },
  ],
  [
    'over_email_send_rate_limit',
    (cause) => {
      throw new RateLimitedError('email_delivery', { cause })
    },
  ],
  [
    'over_sms_send_rate_limit',
    (cause) => {
      throw new RateLimitedError('email_delivery', { cause })
    },
  ],
  [
    'email_not_confirmed',
    (cause) => {
      throw new EmailNotConfirmedError({ cause })
    },
  ],
  [
    'user_banned',
    (cause) => {
      throw new AccountBlockedError({ cause })
    },
  ],
  [
    'signup_disabled',
    (cause) => {
      throw new SignUpNotAllowedError({ cause })
    },
  ],
  [
    'email_address_not_authorized',
    (cause) => {
      throw new SignUpNotAllowedError({ cause })
    },
  ],
  [
    'email_exists',
    (cause) => {
      throw new AccountAlreadyExistsError(['email'], { cause })
    },
  ],
  [
    'user_already_exists',
    (cause) => {
      throw new AccountAlreadyExistsError(['email'], { cause })
    },
  ],
  [
    'email_address_invalid',
    (cause) => {
      throw new InvalidAccountValueError('email', { cause })
    },
  ],
  [
    'weak_password',
    (cause) => {
      throw new InvalidAccountValueError('password', { cause })
    },
  ],
  [
    'same_password',
    (cause) => {
      throw new InvalidAccountValueError('password', { cause })
    },
  ],
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

function providerErrorName(error: unknown): string | null {
  return isRecord(error) ? readString(error, 'name') : null
}

function isInvalidAccessTokenError(error: unknown): boolean {
  const code = providerErrorCode(error)
  if (code !== null && INVALID_ACCESS_TOKEN_CODES.has(code)) return true

  const name = providerErrorName(error)
  return name !== null && INVALID_ACCESS_TOKEN_ERROR_NAMES.has(name)
}

function readAuthenticationMethod(claims: Record<string, unknown>): AuthenticationMethod | null {
  const references = claims.amr
  if (!Array.isArray(references)) return null

  for (const reference of references) {
    if (!isRecord(reference)) continue
    const method = readString(reference, 'method')
    if (
      method === 'password' ||
      method === 'otp' ||
      method === 'recovery' ||
      method === 'email/signup' ||
      method === 'token_refresh'
    ) {
      return 'password'
    }
    if (method === 'oauth') return 'google'
  }

  return null
}

function translateProviderError(error: unknown): void {
  const code = providerErrorCode(error)
  if (code === null) return

  ERROR_BY_PROVIDER_CODE.get(code)?.(error)
}

function rejectionFrom(error: unknown, fallback: AuthenticationRejectionReason): never {
  translateProviderError(error)

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
    if (result.error !== null) rejectionFrom(result.error, 'invalid_credentials')
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

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    const result = await this.call(() => this.api.refreshSession(refreshToken))
    if (result.error !== null) {
      translateProviderError(result.error)
      const code = providerErrorCode(result.error)
      if (code !== null && INVALID_REFRESH_TOKEN_CODES.has(code)) {
        throw new AuthenticationRejectedError('refresh_token_invalid', { cause: result.error })
      }

      throw new AuthProviderError({ cause: result.error })
    }

    return this.sessionFrom(result.data, 'refresh_token_invalid')
  }

  async verifyEmailOtp(tokenHash: string, type: EmailOtpVerificationType): Promise<AuthSession> {
    const result = await this.call(() => this.api.verifyOtp(tokenHash, type))
    if (result.error !== null) {
      translateProviderError(result.error)
      throw new AuthenticationRejectedError(
        type === 'recovery' ? 'recovery_link_invalid' : 'email_link_invalid',
        { cause: result.error },
      )
    }

    return this.sessionFrom(
      result.data,
      type === 'recovery' ? 'recovery_link_invalid' : 'email_link_invalid',
    )
  }

  async resendSignUpConfirmation(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<void> {
    const result = await this.call(() => this.api.resendSignUpConfirmation(params))
    if (result.error !== null) rejectionFrom(result.error, 'invalid_credentials')
  }

  async requestPasswordRecovery(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<void> {
    const result = await this.call(() => this.api.requestPasswordRecovery(params))
    if (result.error !== null) rejectionFrom(result.error, 'invalid_credentials')
  }

  async updatePassword(authUserId: string, password: string): Promise<void> {
    const result = await this.call(() => this.api.updatePassword(authUserId, password))
    if (result.error !== null) {
      translateProviderError(result.error)
      throw new AuthProviderError({ cause: result.error })
    }
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

    if (result.error !== null) {
      if (isInvalidAccessTokenError(result.error)) return null

      throw new AuthProviderError({ cause: result.error })
    }

    return readIdentity(result.data)
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
