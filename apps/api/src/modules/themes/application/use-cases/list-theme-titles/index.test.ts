import { describe, expect, it } from 'vitest'

import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'

import { ListThemeTitlesUseCase } from './index.js'

const NOW = new Date('2026-08-16T12:00:00.000Z')

function createTheme(themeId: string, title: string): Theme {
  return Theme.create({
    id: themeId,
    categoryId: 'category-1',
    title: ThemeTitle.create(title),
    difficulty: 'balanced',
    createdAt: NOW,
  })
}

function themesRepositoryHolding(themes: readonly Theme[]): {
  readonly repository: ThemesRepository
  readonly requestedIds: (readonly string[])[]
} {
  const requestedIds: (readonly string[])[] = []

  return {
    requestedIds,
    repository: {
      findById: () => Promise.resolve(null),
      listByIds: (themeIds) => {
        requestedIds.push(themeIds)
        return Promise.resolve(themes.filter((theme) => themeIds.includes(theme.id)))
      },
      findByNormalizedTitle: () => Promise.resolve(null),
      save: () => Promise.resolve(),
      countPublishedBy: () => Promise.resolve(0),
      drawPublished: () => Promise.resolve(null),
      listPublishedCombinations: () => Promise.resolve([]),
    },
  }
}

describe('ListThemeTitlesUseCase', () => {
  it('returns the title of every theme it finds', async () => {
    const { repository } = themesRepositoryHolding([
      createTheme('theme-1', 'Climate Change'),
      createTheme('theme-2', 'Housing Crisis'),
    ])
    const useCase = new ListThemeTitlesUseCase({ themes: repository })

    await expect(useCase.execute({ themeIds: ['theme-1', 'theme-2'] })).resolves.toEqual([
      { themeId: 'theme-1', title: 'Climate Change' },
      { themeId: 'theme-2', title: 'Housing Crisis' },
    ])
  })

  it('omits an identifier that no longer resolves to a theme', async () => {
    const { repository } = themesRepositoryHolding([createTheme('theme-1', 'Climate Change')])
    const useCase = new ListThemeTitlesUseCase({ themes: repository })

    await expect(useCase.execute({ themeIds: ['theme-1', 'theme-missing'] })).resolves.toEqual([
      { themeId: 'theme-1', title: 'Climate Change' },
    ])
  })

  it('asks the repository for each identifier only once', async () => {
    const { repository, requestedIds } = themesRepositoryHolding([
      createTheme('theme-1', 'Climate Change'),
    ])
    const useCase = new ListThemeTitlesUseCase({ themes: repository })

    await useCase.execute({ themeIds: ['theme-1', 'theme-1', 'theme-1'] })

    expect(requestedIds).toEqual([['theme-1']])
  })
})
