import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class AudioSizeRejectedError extends UnprocessableError {
  readonly code = 'sessions.AUDIO_SIZE_REJECTED'

  constructor(sizeBytes: number) {
    super('Audio size exceeds the allowed limit', { context: { sizeBytes } })
  }
}
