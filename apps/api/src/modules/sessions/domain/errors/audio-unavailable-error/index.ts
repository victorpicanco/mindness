import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class AudioUnavailableError extends NotFoundError {
  readonly code = 'sessions.AUDIO_UNAVAILABLE'

  constructor(sessionId: string) {
    super('Session audio is unavailable', { context: { sessionId } })
  }
}
