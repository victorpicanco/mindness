import { describe, expect, it } from 'vitest'

import { Theme, type ThemeDifficulty } from '@/modules/themes/domain/entities/theme/index.js'
import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'
import { InMemoryThemeCategoriesRepository } from '@/modules/themes/infrastructure/repositories/in-memory-theme-categories-repository/index.js'

import { InMemoryThemesRepository } from './index.js'

function createTheme(id: string, title: string, difficulty: ThemeDifficulty = 'easy'): Theme {
  return Theme.create({
    id,
    title: ThemeTitle.create(title),
    categoryId: 'category-1',
    difficulty,
    createdAt: new Date('2026-08-16T12:00:00.000Z'),
  })
}

describe('InMemoryThemesRepository', () => {
  it('implements the complete repository interfaces', () => {
    const themesRepository: ThemesRepository = new InMemoryThemesRepository()
    const categoriesRepository: ThemeCategoriesRepository = new InMemoryThemeCategoriesRepository(
      themesRepository,
    )

    expect(themesRepository).toBeInstanceOf(InMemoryThemesRepository)
    expect(categoriesRepository).toBeInstanceOf(InMemoryThemeCategoriesRepository)
  })

  it('returns the first published theme for a combination', async () => {
    const repository = new InMemoryThemesRepository()
    const firstPublished = createTheme('theme-1', 'First published theme')
    const secondPublished = createTheme('theme-2', 'Second published theme')
    const draft = createTheme('theme-3', 'Draft theme')
    firstPublished.publish()
    secondPublished.publish()

    await repository.save(firstPublished)
    await repository.save(secondPublished)
    await repository.save(draft)

    await expect(
      repository.drawPublished({ categoryId: 'category-1', difficulty: 'easy' }),
    ).resolves.toBe(firstPublished)
  })

  it('returns null when the combination has no published themes', async () => {
    const repository = new InMemoryThemesRepository()

    await expect(
      repository.drawPublished({ categoryId: 'category-1', difficulty: 'easy' }),
    ).resolves.toBeNull()
  })

  it('throws a simulated failure for only the next command', async () => {
    const repository = new InMemoryThemesRepository()
    const failure = new InvalidThemeValueError('title')
    repository.simulateFailure(failure)

    await expect(repository.findById('theme-1')).rejects.toBe(failure)
    await expect(repository.findById('theme-1')).resolves.toBeNull()
  })
})
