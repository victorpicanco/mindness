import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'

import type { ListThemeCategoriesInput, ListThemeCategoriesOutput } from './types.js'

export interface ListThemeCategoriesDependencies {
  readonly categories: ThemeCategoriesRepository
}

export class ListThemeCategoriesUseCase {
  constructor(private readonly dependencies: ListThemeCategoriesDependencies) {}

  async execute(input: ListThemeCategoriesInput): Promise<ListThemeCategoriesOutput> {
    void input
    const categories = await this.dependencies.categories.listWithPublishedThemes()

    return categories.map((category) => ({
      categoryId: category.id,
      slug: category.slug.value,
      name: category.name,
    }))
  }
}

export type {
  ListThemeCategoriesInput,
  ListThemeCategoriesOutput,
  ThemeCategoryListItem,
} from './types.js'
