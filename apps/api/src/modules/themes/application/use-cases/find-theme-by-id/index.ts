import { ThemeCategoryNotFoundError } from '@/modules/themes/domain/errors/theme-category-not-found-error/index.js'
import { ThemeNotFoundError } from '@/modules/themes/domain/errors/theme-not-found-error/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'

import type { FindThemeByIdOutput } from './types.js'

export interface FindThemeByIdDependencies {
  readonly themes: ThemesRepository
  readonly categories: ThemeCategoriesRepository
}

export class FindThemeByIdUseCase {
  constructor(private readonly dependencies: FindThemeByIdDependencies) {}

  async execute(themeId: string): Promise<FindThemeByIdOutput> {
    const theme = await this.dependencies.themes.findById(themeId)
    if (theme === null) throw new ThemeNotFoundError(themeId)

    const category = await this.dependencies.categories.findById(theme.categoryId)
    if (category === null) throw new ThemeCategoryNotFoundError(theme.categoryId)

    return {
      themeId: theme.id,
      title: theme.title.value,
      categorySlug: category.slug.value,
      difficulty: theme.difficulty,
    }
  }
}

export type { FindThemeByIdOutput } from './types.js'
