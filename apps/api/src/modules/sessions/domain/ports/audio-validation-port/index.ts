export interface ValidAudio {
  readonly ok: true
  readonly durationSeconds: number
  readonly contentType: string
}

export interface InvalidAudio {
  readonly ok: false
}

export interface ValidateAudioInput {
  readonly buffer: Buffer
}

export interface AudioValidationPort {
  validate(input: ValidateAudioInput): Promise<ValidAudio | InvalidAudio>
}
