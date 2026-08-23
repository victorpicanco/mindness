import { describe, expect, it } from 'vitest'

import type { ThemesEligibilityReader } from './index.js'
import { ThemesPortAdapter } from './index.js'

describe('ThemesPortAdapter', () => {
  it('returns the categories provided by the themes facade without changing their shape', async () => {
    const categories = [
      { categoryId: 'category-1', slug: 'reflection', name: 'Reflection' },
      { categoryId: 'category-2', slug: 'focus', name: 'Focus' },
    ] as const
    const themesFacade: ThemesEligibilityReader = {
      drawEligibleTheme: () => Promise.resolve(null),
      listCategories: () => Promise.resolve(categories),
    }
    const adapter = new ThemesPortAdapter(themesFacade)

    await expect(adapter.listCategories()).resolves.toStrictEqual(categories)
  })
})
