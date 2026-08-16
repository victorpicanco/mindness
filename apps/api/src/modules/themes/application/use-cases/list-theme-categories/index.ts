import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'

import type { ListThemeCategoriesOutput } from './types.js'

export interface ListThemeCategoriesDependencies {
  readonly categories: ThemeCategoriesRepository
}

export class ListThemeCategoriesUseCase {
  constructor(private readonly dependencies: ListThemeCategoriesDependencies) {}

  async execute(): Promise<ListThemeCategoriesOutput> {
    const categories = await this.dependencies.categories.listWithPublishedThemes()

    return categories.map((category) => ({
      categoryId: category.id,
      slug: category.slug.value,
      name: category.name,
    }))
  }
}

export type { ListThemeCategoriesOutput, ThemeCategoryListItem } from './types.js'
