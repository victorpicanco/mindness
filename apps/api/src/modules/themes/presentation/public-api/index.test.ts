import { describe, expect, it } from 'vitest'

import type { ThemesPublicApi } from './index.js'
import { ThemesPublicApiImpl } from './index.js'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false
type Assert<Condition extends true> = Condition
type ThemesPublicApiExposesOnlyReads = Assert<
  Equal<
    keyof ThemesPublicApi,
    'drawEligibleTheme' | 'findThemeById' | 'listCategories' | 'listThemeTitles'
  >
>

const themesPublicApiExposesOnlyReads: ThemesPublicApiExposesOnlyReads = true

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
      execute: ({ themeId }: { readonly themeId: string }) => {
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
    const listThemeTitles = {
      execute: ({ themeIds }: { readonly themeIds: readonly string[] }) => {
        expect(themeIds).toEqual(['theme-1'])

        return Promise.resolve([{ themeId: 'theme-1', title: 'Observe your thoughts' }])
      },
    }
    const api = new ThemesPublicApiImpl({
      drawEligibleTheme,
      findThemeById,
      listThemeCategories,
      listThemeTitles,
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
    await expect(api.listThemeTitles(['theme-1'])).resolves.toEqual([
      { themeId: 'theme-1', title: 'Observe your thoughts' },
    ])
  })

  it('does not expose catalog write operations', () => {
    expect(themesPublicApiExposesOnlyReads).toBe(true)
    const methods = Object.getOwnPropertyNames(ThemesPublicApiImpl.prototype)

    expect(methods).not.toContain('createTheme')
    expect(methods).not.toContain('publishTheme')
    expect(methods).not.toContain('moveThemeToDraft')
    expect(methods).not.toContain('withdrawTheme')
    expect(methods).not.toContain('synchronizeThemeCatalog')
  })
})
