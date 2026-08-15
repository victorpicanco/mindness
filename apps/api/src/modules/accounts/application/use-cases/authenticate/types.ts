export interface AuthenticateInput {
  readonly accessToken: string
}

export interface AuthenticateOutput {
  readonly accountId: string | null
  readonly authUserId: string
  readonly email: string
  readonly sessionId: string
  readonly issuedAt: Date
}
