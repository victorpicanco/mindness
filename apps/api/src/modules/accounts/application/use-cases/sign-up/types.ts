export interface SignUpInput {
  readonly email: string
  readonly password: string
  readonly captchaToken: string
}

export interface SignUpOutput {
  readonly message: string
}
