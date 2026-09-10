export interface SignInAnonymouslyInput {
  readonly captchaToken: string
}

export interface SignInAnonymouslyOutput {
  readonly accessToken: string
  readonly refreshToken: string
  readonly expiresAt: string
}
