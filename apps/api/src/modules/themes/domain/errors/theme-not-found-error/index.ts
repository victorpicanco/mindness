import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class ThemeNotFoundError extends NotFoundError {
  readonly code = 'themes.THEME_NOT_FOUND'

  constructor(themeId: string) {
    super('Theme was not found', { context: { themeId } })
  }
}
