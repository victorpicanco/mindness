import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import { EmailNotConfirmedError } from '@/modules/accounts/domain/errors/email-not-confirmed-error/index.js'
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
import type { Clock } from '@/modules/accounts/domain/ports/clock/index.js'
import type { IdGenerator } from '@/modules/accounts/domain/ports/id-generator/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

interface PasswordUser {
  readonly authUserId: string
  readonly email: string
  password: string
  confirmed: boolean
}

export interface InMemoryGoogleIdentity {
  readonly authUserId: string
  readonly email: string
  readonly emailVerified: boolean
}

export class InMemoryAuthIdentityProviderAdapter implements AuthIdentityProvider {
  private readonly passwordUsers = new Map<string, PasswordUser>()
  private readonly googleCodes = new Map<string, InMemoryGoogleIdentity>()
  private readonly validPkceStates = new Set<string>()
  private readonly sessionsByToken = new Map<string, AuthSession>()
  private readonly sessionsByRefreshToken = new Map<string, AuthSession>()
  private readonly currentTokenByUser = new Map<string, string>()
  private readonly emailByOtpToken = new Map<string, string>()
  private failure: BaseError | null = null

  constructor(
    private readonly clock: Clock,
    private readonly idGenerator: IdGenerator,
  ) {}

  async signUpWithPassword(params: SignUpWithPasswordParams): Promise<void> {
    await this.ensureNoSimulatedFailure()
    if (this.passwordUsers.has(params.email)) return

    this.passwordUsers.set(params.email, {
      authUserId: this.idGenerator.generate(),
      email: params.email,
      password: params.password,
      confirmed: false,
    })
    const user = this.passwordUsers.get(params.email)
    if (user !== undefined)
      this.emailByOtpToken.set(`confirmation-${user.authUserId}`, params.email)
  }

  async signInWithPassword(params: SignInWithPasswordParams): Promise<AuthSession> {
    await this.ensureNoSimulatedFailure()
    const user = this.passwordUsers.get(params.email)
    if (user === undefined || user.password !== params.password) {
      throw new AuthenticationRejectedError('invalid_credentials')
    }
    if (!user.confirmed) {
      throw new EmailNotConfirmedError()
    }

    return this.createSession(user.authUserId, user.email, 'password')
  }

  async createGoogleAuthorization(redirectTo: string): Promise<GoogleAuthorization> {
    await this.ensureNoSimulatedFailure()
    const pkceState = this.idGenerator.generate()
    this.validPkceStates.add(pkceState)
    const url = new URL('https://accounts.test/google')
    url.searchParams.set('redirect_to', redirectTo)
    return { authorizationUrl: url.toString(), pkceState }
  }

  async exchangeGoogleCode(code: string, pkceState: string): Promise<AuthSession> {
    await this.ensureNoSimulatedFailure()
    const identity = this.googleCodes.get(code)
    if (!this.validPkceStates.delete(pkceState) || identity?.emailVerified !== true) {
      throw new AuthenticationRejectedError('google_failed')
    }

    return this.createSession(identity.authUserId, identity.email, 'google')
  }

  async refreshSession(refreshToken: string): Promise<AuthSession> {
    await this.ensureNoSimulatedFailure()
    const session = this.sessionsByRefreshToken.get(refreshToken)
    if (session === undefined) {
      throw new AuthenticationRejectedError('refresh_token_invalid')
    }

    this.sessionsByRefreshToken.delete(refreshToken)
    // Supabase chains refresh tokens inside one session: the tokens rotate and
    // the session id survives. Minting a new one would hide single-session
    // eviction (ADR-001) from every flow that runs on this adapter.
    return this.storeSession(
      { ...session.identity, issuedAt: this.clock.now() },
      this.idGenerator.generate(),
    )
  }

  async verifyEmailOtp(tokenHash: string, type: EmailOtpVerificationType): Promise<AuthSession> {
    await this.ensureNoSimulatedFailure()
    const email = this.emailByOtpToken.get(tokenHash)
    this.emailByOtpToken.delete(tokenHash)
    const user = email === undefined ? undefined : this.passwordUsers.get(email)
    if (user === undefined) {
      throw new AuthenticationRejectedError(
        type === 'recovery' ? 'recovery_link_invalid' : 'email_link_invalid',
      )
    }
    if (type === 'email') user.confirmed = true

    return this.createSession(user.authUserId, user.email, 'password')
  }

  async resendSignUpConfirmation(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<void> {
    await this.ensureNoSimulatedFailure()
    const user = this.passwordUsers.get(params.email)
    if (user !== undefined && !user.confirmed) {
      this.emailByOtpToken.set(`confirmation-${user.authUserId}`, params.email)
    }
  }

  async requestPasswordRecovery(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<void> {
    await this.ensureNoSimulatedFailure()
    const user = this.passwordUsers.get(params.email)
    if (user !== undefined && user.confirmed) {
      this.emailByOtpToken.set(`recovery-${user.authUserId}`, params.email)
    }
  }

  async updatePassword(authUserId: string, password: string): Promise<void> {
    await this.ensureNoSimulatedFailure()
    for (const user of this.passwordUsers.values()) {
      if (user.authUserId === authUserId) user.password = password
    }
  }

  async validateAccessToken(accessToken: string): Promise<VerifiedAuthIdentity> {
    await this.ensureNoSimulatedFailure()
    const session = this.sessionsByToken.get(accessToken)
    if (session === undefined) {
      throw new AuthenticationRejectedError('invalid_token')
    }
    return session.identity
  }

  async revokeSession(accessToken: string): Promise<void> {
    await this.ensureNoSimulatedFailure()
    const session = this.sessionsByToken.get(accessToken)
    this.sessionsByToken.delete(accessToken)
    if (session !== undefined) {
      this.sessionsByRefreshToken.delete(session.refreshToken)
      this.currentTokenByUser.delete(session.identity.authUserId)
    }
  }

  confirmEmail(email: string): void {
    const user = this.passwordUsers.get(email)
    if (user !== undefined) user.confirmed = true
  }

  emailConfirmationTokenFor(email: string): string | null {
    for (const [token, tokenEmail] of this.emailByOtpToken) {
      if (tokenEmail === email && token.startsWith('confirmation-')) return token
    }
    return null
  }

  passwordRecoveryTokenFor(email: string): string | null {
    for (const [token, tokenEmail] of this.emailByOtpToken) {
      if (tokenEmail === email && token.startsWith('recovery-')) return token
    }
    return null
  }

  registerGoogleCode(code: string, identity: InMemoryGoogleIdentity): void {
    this.googleCodes.set(code, identity)
  }

  simulateFailure(error: BaseError): void {
    this.failure = error
  }

  reset(): void {
    this.passwordUsers.clear()
    this.googleCodes.clear()
    this.validPkceStates.clear()
    this.sessionsByToken.clear()
    this.sessionsByRefreshToken.clear()
    this.currentTokenByUser.clear()
    this.emailByOtpToken.clear()
    this.failure = null
  }

  private createSession(
    authUserId: string,
    email: string,
    authenticationMethod: AuthenticationMethod,
  ): AuthSession {
    const sessionId = this.idGenerator.generate()

    return this.storeSession(
      { authUserId, email, issuedAt: this.clock.now(), sessionId, authenticationMethod },
      sessionId,
    )
  }

  private storeSession(identity: VerifiedAuthIdentity, tokenId: string): AuthSession {
    const previousToken = this.currentTokenByUser.get(identity.authUserId)
    if (previousToken !== undefined) {
      const previousSession = this.sessionsByToken.get(previousToken)
      this.sessionsByToken.delete(previousToken)
      if (previousSession !== undefined) {
        this.sessionsByRefreshToken.delete(previousSession.refreshToken)
      }
    }

    const accessToken = `access-${tokenId}`
    const session: AuthSession = {
      accessToken,
      refreshToken: `refresh-${tokenId}`,
      expiresAt: new Date(identity.issuedAt.getTime() + 60 * 60 * 1000),
      identity,
    }
    this.sessionsByToken.set(accessToken, session)
    this.sessionsByRefreshToken.set(session.refreshToken, session)
    this.currentTokenByUser.set(identity.authUserId, accessToken)
    return session
  }

  private ensureNoSimulatedFailure(): Promise<void> {
    if (this.failure === null) return Promise.resolve()
    const failure = this.failure
    this.failure = null
    return Promise.reject(failure)
  }
}
