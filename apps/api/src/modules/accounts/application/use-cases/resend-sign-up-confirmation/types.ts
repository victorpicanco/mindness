export interface ResendSignUpConfirmationInput {
  readonly email: string
  readonly captchaToken: string
}

export interface ResendSignUpConfirmationOutput {
  readonly message: string
}
