import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class SessionNotFoundError extends NotFoundError {
  readonly code = 'sessions.SESSION_NOT_FOUND'

  constructor(sessionId: string) {
    super('Session not found', { context: { sessionId } })
  }
}
