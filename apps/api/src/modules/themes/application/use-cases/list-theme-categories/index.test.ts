import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'

import { ListThemeCategoriesUseCase } from './index.js'

class FakeThemeCategoriesRepository implements ThemeCategoriesRepository {
  private readonly categories: ThemeCategory[] = []
  findById(): Promise<ThemeCategory | null> {
    return Promise.resolve(null)
  }
  findBySlug(): Promise<ThemeCategory | null> {
    return Promise.resolve(null)
  }
  save(category: ThemeCategory): Promise<void> {
    this.categories.push(category)
    return Promise.resolve()
  }
  listWithPublishedThemes(): Promise<ThemeCategory[]> {
    return Promise.resolve(this.categories)
  }
}

describe('ListThemeCategoriesUseCase', () => {
  it('maps the categories supplied by the repository', async () => {
    const categories = new FakeThemeCategoriesRepository()
    await categories.save(
      ThemeCategory.create({
        id: 'category-1',
        slug: CategorySlug.create('mindfulness'),
        name: 'Mindfulness',
      }),
    )
    const useCase = new ListThemeCategoriesUseCase({ categories })

    await expect(useCase.execute(null)).resolves.toEqual([
      { categoryId: 'category-1', slug: 'mindfulness', name: 'Mindfulness' },
    ])
  })
})
