import { describe, expect, it } from 'vitest'

import { ThemesPublicApiImpl } from './index.js'

describe('ThemesPublicApiImpl', () => {
  it('delegates each read operation to its use case and translates the results', async () => {
    const drawEligibleTheme = {
      execute: (input: {
        readonly categorySlug: string
        readonly difficulty: 'easy' | 'balanced' | 'hard'
      }) => {
        expect(input).toEqual({ categorySlug: 'reflection', difficulty: 'balanced' })

        return Promise.resolve({
          themeId: 'theme-1',
          title: 'Observe your thoughts',
          categorySlug: 'reflection',
          difficulty: 'balanced' as const,
        })
      },
    }
    const findThemeById = {
      execute: (themeId: string) => {
        expect(themeId).toBe('theme-1')

        return Promise.resolve({
          themeId,
          title: 'Observe your thoughts',
          categorySlug: 'reflection',
          difficulty: 'balanced' as const,
        })
      },
    }
    const listThemeCategories = {
      execute: () =>
        Promise.resolve([{ categoryId: 'category-1', slug: 'reflection', name: 'Reflection' }]),
    }
    const api = new ThemesPublicApiImpl({
      drawEligibleTheme,
      findThemeById,
      listThemeCategories,
    })

    await expect(
      api.drawEligibleTheme({ categorySlug: 'reflection', difficulty: 'balanced' }),
    ).resolves.toEqual({
      themeId: 'theme-1',
      title: 'Observe your thoughts',
      categorySlug: 'reflection',
      difficulty: 'balanced',
    })
    await expect(api.findThemeById('theme-1')).resolves.toEqual({
      themeId: 'theme-1',
      title: 'Observe your thoughts',
      categorySlug: 'reflection',
      difficulty: 'balanced',
    })
    await expect(api.listCategories()).resolves.toEqual([
      { categoryId: 'category-1', slug: 'reflection', name: 'Reflection' },
    ])
  })
})
