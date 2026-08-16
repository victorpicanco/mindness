import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class InvalidThemeTransitionError extends ConflictError {
  readonly code = 'themes.INVALID_THEME_TRANSITION'

  constructor(currentStatus: string, targetStatus: string) {
    super('Theme publication transition is invalid', {
      context: { currentStatus, targetStatus },
    })
  }
}
