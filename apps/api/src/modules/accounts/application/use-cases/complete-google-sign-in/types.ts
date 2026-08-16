export interface CompleteGoogleSignInInput {
  readonly code: string
  readonly pkceState: string | null
}

export interface CompleteGoogleSignInOutput {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: string
}
