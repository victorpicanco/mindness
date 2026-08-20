import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

import type { SessionState } from '@/modules/sessions/domain/entities/session/index.js'

export class SessionNotInProgressError extends ConflictError {
  readonly code = 'sessions.SESSION_NOT_IN_PROGRESS'

  constructor(state: SessionState) {
    super('Session is not in progress', { context: { state } })
  }
}
