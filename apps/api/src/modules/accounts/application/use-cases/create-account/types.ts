export interface CreateAccountInput {
  readonly accessToken: string
  readonly timeZone: string | null
}

export interface CreateAccountOutput {
  readonly message: string
}
