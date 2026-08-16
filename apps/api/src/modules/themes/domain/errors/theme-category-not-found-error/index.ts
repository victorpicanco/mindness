import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class ThemeCategoryNotFoundError extends NotFoundError {
  readonly code = 'themes.THEME_CATEGORY_NOT_FOUND'

  constructor(categoryId: string) {
    super('Theme category was not found', { context: { categoryId } })
  }
}
