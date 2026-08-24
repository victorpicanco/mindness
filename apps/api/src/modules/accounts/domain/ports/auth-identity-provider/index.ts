export type AuthenticationMethod = 'password' | 'google'
export type EmailOtpVerificationType = 'email' | 'recovery'

export interface VerifiedAuthIdentity {
  readonly authUserId: string
  readonly email: string
  readonly sessionId: string
  readonly issuedAt: Date
  readonly authenticationMethod: AuthenticationMethod
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

export interface IdentityRegistrar {
  signUpWithPassword(params: SignUpWithPasswordParams): Promise<void>
}

export interface PasswordAuthenticator {
  signInWithPassword(params: SignInWithPasswordParams): Promise<AuthSession>
}

export interface RefreshTokenAuthenticator {
  refreshSession(refreshToken: string): Promise<AuthSession>
}

export interface EmailOtpVerifier {
  verifyEmailOtp(tokenHash: string, type: EmailOtpVerificationType): Promise<AuthSession>
}

export interface ConfirmationResender {
  resendSignUpConfirmation(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<void>
}

export interface PasswordRecoveryRequester {
  requestPasswordRecovery(params: {
    readonly email: string
    readonly captchaToken: string
  }): Promise<void>
}

export interface PasswordUpdater {
  updatePassword(authUserId: string, password: string): Promise<void>
}

export interface GoogleAuthenticator {
  createGoogleAuthorization(redirectTo: string): Promise<GoogleAuthorization>
  exchangeGoogleCode(code: string, pkceState: string): Promise<AuthSession>
}

export interface AuthIdentityProvider
  extends
    AccessTokenValidator,
    SessionRevoker,
    IdentityRegistrar,
    PasswordAuthenticator,
    RefreshTokenAuthenticator,
    EmailOtpVerifier,
    ConfirmationResender,
    PasswordRecoveryRequester,
    PasswordUpdater,
    GoogleAuthenticator {}
