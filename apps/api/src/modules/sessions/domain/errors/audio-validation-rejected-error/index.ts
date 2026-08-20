import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class AudioValidationRejectedError extends UnprocessableError {
  readonly code = 'sessions.AUDIO_VALIDATION_REJECTED'

  constructor(storagePath: string) {
    super('Audio validation failed', { context: { storagePath } })
  }
}
