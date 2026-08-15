export interface GetAccountProfileInput {
  readonly accessToken: string
}

export interface AccountConsentView {
  readonly purpose: 'voice_recording_and_analysis'
  readonly version: string
  readonly acceptedAt: string
}

export interface GetAccountProfileOutput {
  readonly accountId: string
  readonly email: string
  readonly timeZone: string
  readonly plan: 'free'
  readonly consent: AccountConsentView | null
}
