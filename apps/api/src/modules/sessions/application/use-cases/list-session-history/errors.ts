import { ValidationError } from '@/shared/errors/categories/validation-error/index.js'

export class InvalidHistoryCursorError extends ValidationError {
  readonly code = 'sessions.INVALID_HISTORY_CURSOR'

  constructor() {
    super('Invalid history cursor', {
      context: { issues: [{ field: 'cursor', message: 'Unknown history cursor' }] },
    })
  }
}
