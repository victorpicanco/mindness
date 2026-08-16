import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class ThemeTitleAlreadyUsedError extends ConflictError {
  readonly code = 'themes.THEME_TITLE_ALREADY_USED'

  constructor(categoryId: string, normalizedTitle: string, options?: { cause?: unknown }) {
    super('Theme title is already used in this category', {
      context: { categoryId, normalizedTitle },
      cause: options?.cause,
    })
  }
}
