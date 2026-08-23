import { describe, expect, it } from 'vitest'

import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'

import { ListSessionThemeCategoriesUseCase } from './index.js'

function createThemes(categories: Awaited<ReturnType<ThemesPort['listCategories']>>): ThemesPort {
  return {
    drawEligibleTheme: () => Promise.resolve(null),
    findThemeById: (themeId) => Promise.resolve({ themeId, title: 'Theme' }),
    listCategories: () => Promise.resolve(categories),
  }
}

describe('ListSessionThemeCategoriesUseCase', () => {
  it('returns the eligible categories provided by the themes port', async () => {
    const categories = [
      { categoryId: 'category-1', slug: 'reflection', name: 'Reflection' },
      { categoryId: 'category-2', slug: 'focus', name: 'Focus' },
    ]
    const useCase = new ListSessionThemeCategoriesUseCase({ themes: createThemes(categories) })

    await expect(useCase.execute()).resolves.toStrictEqual(categories)
  })
})
