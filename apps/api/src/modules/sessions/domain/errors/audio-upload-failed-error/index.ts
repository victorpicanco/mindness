import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class AudioUploadFailedError extends UnprocessableError {
  readonly code = 'sessions.AUDIO_UPLOAD_FAILED'

  constructor(storagePath: string) {
    super('Audio upload failed', { context: { storagePath } })
  }
}
