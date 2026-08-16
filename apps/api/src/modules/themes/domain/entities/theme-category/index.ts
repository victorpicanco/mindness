import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import type { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'

const MINIMUM_CATEGORY_NAME_LENGTH = 2
const MAXIMUM_CATEGORY_NAME_LENGTH = 60

export interface CreateThemeCategoryParams {
  readonly id: string
  readonly slug: CategorySlug
  readonly name: string
}

export class ThemeCategory {
  private constructor(
    readonly id: string,
    readonly slug: CategorySlug,
    readonly name: string,
  ) {}

  static create(params: CreateThemeCategoryParams): ThemeCategory {
    const nameLength = params.name.trim().length

    if (nameLength < MINIMUM_CATEGORY_NAME_LENGTH || nameLength > MAXIMUM_CATEGORY_NAME_LENGTH) {
      throw new InvalidThemeValueError('name')
    }

    return new ThemeCategory(params.id, params.slug, params.name)
  }
}
