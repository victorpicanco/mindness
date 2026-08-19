import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class SessionAlreadyRunningError extends ConflictError {
  readonly code = 'sessions.SESSION_ALREADY_RUNNING'

  constructor(sessionId: string) {
    super('Session is already running', { context: { sessionId } })
  }
}
