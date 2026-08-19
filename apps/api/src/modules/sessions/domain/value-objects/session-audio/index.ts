import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

// DA-04 and RF-003 cap recordings at sixty seconds.
const MAX_DURATION_SECONDS = 60
// RF-003 limits uploaded audio to 25 MiB.
const MAX_SIZE_BYTES = 25 * 1024 * 1024

export interface CreateSessionAudioParams {
  readonly durationSeconds: number
  readonly sizeBytes: number
  readonly contentType: string
  readonly storagePath: string
}

export class SessionAudio {
  private constructor(
    readonly durationSeconds: number,
    readonly sizeBytes: number,
    readonly contentType: string,
    readonly storagePath: string,
  ) {}

  static create(params: CreateSessionAudioParams): SessionAudio {
    if (
      !Number.isFinite(params.durationSeconds) ||
      params.durationSeconds <= 0 ||
      params.durationSeconds > MAX_DURATION_SECONDS
    ) {
      throw new ValidationFailedError([
        {
          field: 'durationSeconds',
          message: `Duration seconds must be between 0 and ${MAX_DURATION_SECONDS}`,
        },
      ])
    }

    if (!Number.isFinite(params.sizeBytes) || params.sizeBytes > MAX_SIZE_BYTES) {
      throw new ValidationFailedError([
        { field: 'sizeBytes', message: `Size bytes must not exceed ${MAX_SIZE_BYTES}` },
      ])
    }

    return new SessionAudio(
      params.durationSeconds,
      params.sizeBytes,
      params.contentType,
      params.storagePath,
    )
  }

  equals(other: SessionAudio): boolean {
    return (
      this.durationSeconds === other.durationSeconds &&
      this.sizeBytes === other.sizeBytes &&
      this.contentType === other.contentType &&
      this.storagePath === other.storagePath
    )
  }
}
