import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class ThemeCategorySlugNotFoundError extends NotFoundError {
  readonly code = 'themes.THEME_CATEGORY_SLUG_NOT_FOUND'

  constructor(categorySlug: string) {
    super('Theme category was not found', { context: { categorySlug } })
  }
}
