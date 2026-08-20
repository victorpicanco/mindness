import type { SessionDifficulty } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class ThemeUnavailableError extends UnprocessableError {
  readonly code = 'sessions.THEME_UNAVAILABLE'

  constructor(categorySlug: string, difficulty: SessionDifficulty) {
    super('No eligible theme is available', { context: { categorySlug, difficulty } })
  }
}
