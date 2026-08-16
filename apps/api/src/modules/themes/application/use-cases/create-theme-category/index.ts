import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { ThemeCategorySlugAlreadyUsedError } from '@/modules/themes/domain/errors/theme-category-slug-already-used-error/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'

import type { CreateThemeCategoryInput, CreateThemeCategoryOutput } from './types.js'

export interface CreateThemeCategoryDependencies {
  readonly categories: ThemeCategoriesRepository
  readonly idGenerator: IdGenerator
}

export class CreateThemeCategoryUseCase {
  constructor(private readonly dependencies: CreateThemeCategoryDependencies) {}

  async execute(input: CreateThemeCategoryInput): Promise<CreateThemeCategoryOutput> {
    const slug = CategorySlug.create(input.slug)
    const existing = await this.dependencies.categories.findBySlug(slug.value)
    if (existing !== null) throw new ThemeCategorySlugAlreadyUsedError(slug.value)

    const category = ThemeCategory.create({
      id: this.dependencies.idGenerator.generate(),
      slug,
      name: input.name,
    })
    await this.dependencies.categories.save(category)

    return { categoryId: category.id, slug: category.slug.value, name: category.name }
  }
}

export type { CreateThemeCategoryInput, CreateThemeCategoryOutput } from './types.js'
