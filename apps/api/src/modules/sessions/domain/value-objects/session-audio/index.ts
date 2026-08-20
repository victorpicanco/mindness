import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

// DA-04 and RF-003 cap recordings at sixty seconds.
export const MAX_AUDIO_DURATION_SECONDS = 60
// RF-003 limits uploaded audio to 25 MiB.
export const MAX_AUDIO_SIZE_BYTES = 25 * 1024 * 1024

export interface CreateSessionAudioParams {
  readonly id: string
  readonly durationSeconds: number
  readonly sizeBytes: number
  readonly contentType: string
  readonly storagePath: string
}

export class SessionAudio {
  private constructor(
    readonly id: string,
    readonly durationSeconds: number,
    readonly sizeBytes: number,
    readonly contentType: string,
    readonly storagePath: string,
  ) {}

  static create(params: CreateSessionAudioParams): SessionAudio {
    if (
      !Number.isFinite(params.durationSeconds) ||
      params.durationSeconds <= 0 ||
      params.durationSeconds > MAX_AUDIO_DURATION_SECONDS
    ) {
      throw new ValidationFailedError([
        {
          field: 'durationSeconds',
          message: `Duration seconds must be between 0 and ${MAX_AUDIO_DURATION_SECONDS}`,
        },
      ])
    }

    if (
      !Number.isFinite(params.sizeBytes) ||
      params.sizeBytes <= 0 ||
      params.sizeBytes > MAX_AUDIO_SIZE_BYTES
    ) {
      throw new ValidationFailedError([
        {
          field: 'sizeBytes',
          message: `Size bytes must be between 0 and ${MAX_AUDIO_SIZE_BYTES}`,
        },
      ])
    }

    return new SessionAudio(
      params.id,
      params.durationSeconds,
      params.sizeBytes,
      params.contentType,
      params.storagePath,
    )
  }
}
