export interface VerifiedAuthIdentity {
  readonly authUserId: string
  readonly email: string
  readonly sessionId: string
}

export interface AuthIdentityProvider {
  validateAccessToken(accessToken: string): Promise<VerifiedAuthIdentity>
}
