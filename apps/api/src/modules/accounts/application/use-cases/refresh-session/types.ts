export interface RefreshSessionInput {
  readonly refreshToken: string
}

export interface RefreshSessionOutput {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: string
}
