import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'

import { FindThemeByIdUseCase } from './index.js'

class FakeThemeCategoriesRepository implements ThemeCategoriesRepository {
  private readonly categories: ThemeCategory[] = []
  findById(id: string): Promise<ThemeCategory | null> {
    return Promise.resolve(this.categories.find((category) => category.id === id) ?? null)
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

describe('FindThemeByIdUseCase', () => {
  it('returns a withdrawn theme for an already created session', async () => {
    const category = ThemeCategory.create({
      id: 'category-1',
      slug: CategorySlug.create('mindfulness'),
      name: 'Mindfulness',
    })
    const theme = Theme.create({
      id: 'theme-1',
      title: ThemeTitle.create('Notice the breath'),
      categoryId: category.id,
      difficulty: 'easy',
      createdAt: new Date('2026-08-16T00:00:00.000Z'),
    })
    theme.publish()
    theme.withdraw()
    const categories = new FakeThemeCategoriesRepository()
    await categories.save(category)
    const useCase = new FindThemeByIdUseCase({
      categories,
      themes: {
        findById: () => Promise.resolve(theme),
        findByNormalizedTitle: () => Promise.resolve(null),
        save: () => Promise.resolve(),
        countPublishedBy: () => Promise.resolve(0),
        drawPublished: () => Promise.resolve(null),
        listPublishedCombinations: () => Promise.resolve([]),
      },
    })

    await expect(useCase.execute({ themeId: 'theme-1' })).resolves.toEqual({
      themeId: 'theme-1',
      title: 'Notice the breath',
      categorySlug: 'mindfulness',
      difficulty: 'easy',
    })
  })
})
