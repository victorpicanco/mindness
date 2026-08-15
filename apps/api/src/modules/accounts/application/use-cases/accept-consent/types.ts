export interface AcceptConsentInput {
  readonly accessToken: string
}

export interface AcceptConsentOutput {
  readonly acceptedAt: string
  readonly purpose: 'voice_recording_and_analysis'
  readonly version: string
}
