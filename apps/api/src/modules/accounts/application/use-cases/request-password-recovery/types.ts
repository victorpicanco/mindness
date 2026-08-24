export interface RequestPasswordRecoveryInput {
  readonly email: string
  readonly captchaToken: string
}

export interface RequestPasswordRecoveryOutput {
  readonly message: string
}
