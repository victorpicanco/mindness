import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

import type { SessionState } from '@/modules/sessions/domain/entities/session/index.js'

export class SessionNotDeletableError extends ConflictError {
  readonly code = 'sessions.SESSION_NOT_DELETABLE'

  constructor(state: SessionState) {
    super('Session cannot be deleted', { context: { state } })
  }
}
