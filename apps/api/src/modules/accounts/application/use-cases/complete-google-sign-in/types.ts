export interface CompleteGoogleSignInInput {
  readonly code: string | null
  readonly error: string | null
  readonly pkceState: string | null
}

export interface CompleteGoogleSignInOutput {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: string
}
