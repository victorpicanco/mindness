import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class ThemeCategorySlugAlreadyUsedError extends ConflictError {
  readonly code = 'themes.THEME_CATEGORY_SLUG_ALREADY_USED'

  constructor(slug: string, options?: { cause?: unknown }) {
    super('Theme category slug is already used', { context: { slug }, cause: options?.cause })
  }
}
