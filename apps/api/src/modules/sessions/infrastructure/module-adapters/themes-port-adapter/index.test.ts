import { describe, expect, it } from 'vitest'

import type { ThemesEligibilityReader } from './index.js'
import { ThemesPortAdapter } from './index.js'

describe('ThemesPortAdapter', () => {
  it('includes the title when drawing an eligible theme', async () => {
    const themesFacade: ThemesEligibilityReader = {
      drawEligibleTheme: () =>
        Promise.resolve({
          themeId: 'theme-1',
          title: 'Describe a moment of calm',
          categorySlug: 'reflection',
          difficulty: 'easy',
        }),
      findThemeById: () =>
        Promise.resolve({
          themeId: 'theme-1',
          title: 'Describe a moment of calm',
          categorySlug: 'reflection',
          difficulty: 'easy',
        }),
      listCategories: () => Promise.resolve([]),
    }
    const adapter = new ThemesPortAdapter(themesFacade)

    await expect(
      adapter.drawEligibleTheme({ categorySlug: 'reflection', difficulty: 'easy' }),
    ).resolves.toStrictEqual({
      themeId: 'theme-1',
      title: 'Describe a moment of calm',
    })
  })

  it('returns a theme identified by the themes facade', async () => {
    const themesFacade: ThemesEligibilityReader = {
      drawEligibleTheme: () => Promise.resolve(null),
      findThemeById: () =>
        Promise.resolve({
          themeId: 'theme-1',
          title: 'Describe a moment of calm',
          categorySlug: 'reflection',
          difficulty: 'easy',
        }),
      listCategories: () => Promise.resolve([]),
    }
    const adapter = new ThemesPortAdapter(themesFacade)

    await expect(adapter.findThemeById('theme-1')).resolves.toStrictEqual({
      themeId: 'theme-1',
      title: 'Describe a moment of calm',
    })
  })

  it('returns the categories provided by the themes facade without changing their shape', async () => {
    const categories = [
      { categoryId: 'category-1', slug: 'reflection', name: 'Reflection' },
      { categoryId: 'category-2', slug: 'focus', name: 'Focus' },
    ] as const
    const themesFacade: ThemesEligibilityReader = {
      drawEligibleTheme: () => Promise.resolve(null),
      findThemeById: () =>
        Promise.resolve({
          themeId: 'theme-1',
          title: 'Describe a moment of calm',
          categorySlug: 'reflection',
          difficulty: 'easy',
        }),
      listCategories: () => Promise.resolve(categories),
    }
    const adapter = new ThemesPortAdapter(themesFacade)

    await expect(adapter.listCategories()).resolves.toStrictEqual(categories)
  })
})
