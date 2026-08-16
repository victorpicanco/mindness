import { AuthenticationRejectedError } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type {
  AuthIdentityProvider,
  AuthSession,
  AuthenticationMethod,
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
  readonly password: string
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
  private readonly currentTokenByUser = new Map<string, string>()
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
  }

  async signInWithPassword(params: SignInWithPasswordParams): Promise<AuthSession> {
    await this.ensureNoSimulatedFailure()
    const user = this.passwordUsers.get(params.email)
    if (user === undefined || user.password !== params.password) {
      throw new AuthenticationRejectedError('invalid_credentials')
    }
    if (!user.confirmed) {
      throw new AuthenticationRejectedError('email_unconfirmed')
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
    if (session !== undefined) this.currentTokenByUser.delete(session.identity.authUserId)
  }

  confirmEmail(email: string): void {
    const user = this.passwordUsers.get(email)
    if (user !== undefined) user.confirmed = true
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
    this.currentTokenByUser.clear()
    this.failure = null
  }

  private createSession(
    authUserId: string,
    email: string,
    authenticationMethod: AuthenticationMethod,
  ): AuthSession {
    const previousToken = this.currentTokenByUser.get(authUserId)
    if (previousToken !== undefined) this.sessionsByToken.delete(previousToken)

    const sessionId = this.idGenerator.generate()
    const accessToken = `access-${sessionId}`
    const issuedAt = this.clock.now()
    const session: AuthSession = {
      accessToken,
      refreshToken: `refresh-${sessionId}`,
      expiresAt: new Date(issuedAt.getTime() + 60 * 60 * 1000),
      identity: { authUserId, email, issuedAt, sessionId, authenticationMethod },
    }
    this.sessionsByToken.set(accessToken, session)
    this.currentTokenByUser.set(authUserId, accessToken)
    return session
  }

  private ensureNoSimulatedFailure(): Promise<void> {
    if (this.failure === null) return Promise.resolve()
    const failure = this.failure
    this.failure = null
    return Promise.reject(failure)
  }
}
