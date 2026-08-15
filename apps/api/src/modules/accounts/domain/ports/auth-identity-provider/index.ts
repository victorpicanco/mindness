export interface VerifiedAuthIdentity {
  readonly authUserId: string
  readonly email: string
  readonly sessionId: string
  readonly issuedAt: Date
}

export interface AuthSession {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: Date
  readonly identity: VerifiedAuthIdentity
}

export interface SignUpWithPasswordParams {
  readonly email: string
  readonly password: string
  readonly captchaToken: string
}

export type SignInWithPasswordParams = SignUpWithPasswordParams

export interface GoogleAuthorization {
  readonly authorizationUrl: string
  readonly pkceState: string
}

export interface AccessTokenValidator {
  validateAccessToken(accessToken: string): Promise<VerifiedAuthIdentity>
}

export interface SessionRevoker {
  revokeSession(accessToken: string): Promise<void>
}

export interface AuthIdentityProvider extends AccessTokenValidator, SessionRevoker {
  signUpWithPassword(params: SignUpWithPasswordParams): Promise<void>
  signInWithPassword(params: SignInWithPasswordParams): Promise<AuthSession>
  createGoogleAuthorization(redirectTo: string): Promise<GoogleAuthorization>
  exchangeGoogleCode(code: string, pkceState: string): Promise<AuthSession>
}
