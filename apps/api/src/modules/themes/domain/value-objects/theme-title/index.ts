import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'

const MINIMUM_THEME_TITLE_LENGTH = 3
const MAXIMUM_THEME_TITLE_LENGTH = 120

export class ThemeTitle {
  private constructor(
    readonly value: string,
    readonly normalized: string,
  ) {}

  static create(value: string): ThemeTitle {
    const trimmedValue = value.trim()

    if (
      trimmedValue.length < MINIMUM_THEME_TITLE_LENGTH ||
      trimmedValue.length > MAXIMUM_THEME_TITLE_LENGTH
    ) {
      throw new InvalidThemeValueError('title')
    }

    return new ThemeTitle(trimmedValue, trimmedValue.replaceAll(/\s+/g, ' ').toLowerCase())
  }

  equals(other: ThemeTitle): boolean {
    return this.normalized === other.normalized
  }
}
