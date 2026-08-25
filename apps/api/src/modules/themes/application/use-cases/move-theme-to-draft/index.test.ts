import { describe, expect, it } from 'vitest'

import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeNotFoundError } from '@/modules/themes/domain/errors/theme-not-found-error/index.js'
import type { ThemePoolAudit } from '@/modules/themes/domain/ports/theme-pool-audit/index.js'
import type { ThemeCombination } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import { MoveThemeToDraftUseCase } from './index.js'

function publishedTheme(): Theme {
  const theme = Theme.create({
    id: 'theme-1',
    title: ThemeTitle.create('Notice the breath'),
    categoryId: 'category-1',
    difficulty: 'easy',
    createdAt: new Date('2026-08-16T00:00:00.000Z'),
  })
  theme.publish()
  return theme
}

function createHarness(theme: Theme | null) {
  const audited: ThemeCombination[] = []
  const operations: string[] = []
  const themePoolAudit: ThemePoolAudit = {
    record: (combination) => {
      audited.push(combination)
      operations.push('audit')
      return Promise.resolve()
    },
  }

  return {
    audited,
    operations,
    useCase: new MoveThemeToDraftUseCase({
      themes: {
        findById: () => Promise.resolve(theme),
        listByIds: () => Promise.resolve([]),
        findByNormalizedTitle: () => Promise.resolve(null),
        save: () => {
          operations.push('save')
          return Promise.resolve()
        },
        countPublishedBy: () => Promise.resolve(0),
        drawPublished: () => Promise.resolve(null),
        listPublishedCombinations: () => Promise.resolve([]),
      },
      themePoolAudit,
    }),
  }
}

describe('MoveThemeToDraftUseCase', () => {
  it('moves a published theme to draft and audits the pool after persisting it', async () => {
    const harness = createHarness(publishedTheme())

    await expect(harness.useCase.execute({ themeId: 'theme-1' })).resolves.toEqual({
      themeId: 'theme-1',
      publicationStatus: 'draft',
    })

    expect(harness.operations).toEqual(['save', 'audit'])
    expect(harness.audited).toEqual([{ categoryId: 'category-1', difficulty: 'easy' }])
  })

  it('throws ThemeNotFoundError when the theme does not exist', async () => {
    const harness = createHarness(null)

    await expect(harness.useCase.execute({ themeId: 'theme-1' })).rejects.toBeInstanceOf(
      ThemeNotFoundError,
    )
    expect(harness.operations).toEqual([])
  })
})
