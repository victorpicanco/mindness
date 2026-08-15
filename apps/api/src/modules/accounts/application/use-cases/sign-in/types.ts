export interface SignInInput {
  readonly email: string
  readonly password: string
  readonly captchaToken: string
}

export interface SignInOutput {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: string
}
