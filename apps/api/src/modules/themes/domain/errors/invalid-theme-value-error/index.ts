import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class InvalidThemeValueError extends UnprocessableError {
  readonly code = 'themes.INVALID_THEME_VALUE'

  constructor(field: string, options?: { cause?: unknown }) {
    super('Theme value is invalid', { context: { field }, cause: options?.cause })
  }
}
