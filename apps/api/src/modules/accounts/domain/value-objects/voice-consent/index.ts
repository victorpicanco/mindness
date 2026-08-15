export interface CreateVoiceConsentParams {
  readonly version: string
  readonly acceptedAt: Date
}

export class VoiceConsent {
  readonly purpose = 'voice_recording_and_analysis'

  private constructor(
    readonly version: string,
    readonly acceptedAt: Date,
  ) {}

  static create(params: CreateVoiceConsentParams): VoiceConsent {
    return new VoiceConsent(params.version, params.acceptedAt)
  }

  equals(other: VoiceConsent): boolean {
    return (
      this.purpose === other.purpose &&
      this.version === other.version &&
      this.acceptedAt.getTime() === other.acceptedAt.getTime()
    )
  }
}
