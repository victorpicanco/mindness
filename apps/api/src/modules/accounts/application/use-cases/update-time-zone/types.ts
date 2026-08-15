export interface UpdateTimeZoneInput {
  readonly accessToken: string
  readonly timeZone: string
}

export interface UpdateTimeZoneOutput {
  readonly timeZone: string
}
