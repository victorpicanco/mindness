export interface CreateVoiceConsentParams {
  readonly version: string
  readonly acceptedAt: Date
}

export class VoiceConsent {
  readonly purpose = 'voice_recording_and_analysis' as const

  private constructor(
    readonly version: string,
    private readonly acceptedAtEpoch: number,
  ) {}

  get acceptedAt(): Date {
    return new Date(this.acceptedAtEpoch)
  }

  static create(params: CreateVoiceConsentParams): VoiceConsent {
    return new VoiceConsent(params.version, params.acceptedAt.getTime())
  }

  equals(other: VoiceConsent): boolean {
    return (
      this.purpose === other.purpose &&
      this.version === other.version &&
      this.acceptedAt.getTime() === other.acceptedAt.getTime()
    )
  }
}
