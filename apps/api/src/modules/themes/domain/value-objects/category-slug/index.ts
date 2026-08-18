import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'

const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const MINIMUM_CATEGORY_SLUG_LENGTH = 2
const MAXIMUM_CATEGORY_SLUG_LENGTH = 40

export class CategorySlug {
  private constructor(readonly value: string) {}

  static create(value: string): CategorySlug {
    const normalizedValue = value.toLowerCase()

    if (
      normalizedValue.length < MINIMUM_CATEGORY_SLUG_LENGTH ||
      normalizedValue.length > MAXIMUM_CATEGORY_SLUG_LENGTH ||
      !CATEGORY_SLUG_PATTERN.test(normalizedValue)
    ) {
      throw new InvalidThemeValueError('slug')
    }

    return new CategorySlug(normalizedValue)
  }

  equals(other: CategorySlug): boolean {
    return this.value === other.value
  }
}
