import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'

import { CreateThemeCategoryUseCase } from './index.js'

class FakeThemeCategoriesRepository implements ThemeCategoriesRepository {
  readonly categories: ThemeCategory[] = []

  findById(categoryId: string): Promise<ThemeCategory | null> {
    return Promise.resolve(this.categories.find((category) => category.id === categoryId) ?? null)
  }

  findBySlug(slug: string): Promise<ThemeCategory | null> {
    return Promise.resolve(this.categories.find((category) => category.slug.value === slug) ?? null)
  }

  save(category: ThemeCategory): Promise<void> {
    this.categories.push(category)
    return Promise.resolve()
  }

  listWithPublishedThemes(): Promise<ThemeCategory[]> {
    return Promise.resolve([])
  }
}

describe('CreateThemeCategoryUseCase', () => {
  it('rejects a category whose slug is already used', async () => {
    const categories = new FakeThemeCategoriesRepository()
    categories.categories.push(
      ThemeCategory.create({
        id: 'category-1',
        slug: CategorySlug.create('mindfulness'),
        name: 'Mindfulness',
      }),
    )
    const idGenerator: IdGenerator = { generate: () => 'category-2' }
    const useCase = new CreateThemeCategoryUseCase({ categories, idGenerator })

    await expect(
      useCase.execute({ slug: 'mindfulness', name: 'Another name' }),
    ).rejects.toMatchObject({
      code: 'themes.THEME_CATEGORY_SLUG_ALREADY_USED',
      context: { slug: 'mindfulness' },
    })
  })
})
