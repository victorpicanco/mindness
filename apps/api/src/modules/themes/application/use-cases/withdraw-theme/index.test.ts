import { describe, expect, it } from 'vitest'

import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeNotFoundError } from '@/modules/themes/domain/errors/theme-not-found-error/index.js'
import type { ThemePoolAudit } from '@/modules/themes/domain/ports/theme-pool-audit/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import { WithdrawThemeUseCase } from './index.js'

const NOW = new Date('2026-08-16T12:00:00.000Z')

class RecordingThemesRepository implements ThemesRepository {
  private readonly themes: Theme[] = []

  constructor(private readonly operations: string[]) {}

  findById(themeId: string): Promise<Theme | null> {
    return Promise.resolve(this.themes.find((theme) => theme.id === themeId) ?? null)
  }

  findByNormalizedTitle(): Promise<Theme | null> {
    return Promise.resolve(null)
  }

  save(theme: Theme): Promise<void> {
    const index = this.themes.findIndex((candidate) => candidate.id === theme.id)
    if (index === -1) this.themes.push(theme)
    else this.themes[index] = theme
    this.operations.push('save')
    return Promise.resolve()
  }

  countPublishedBy(): Promise<number> {
    return Promise.resolve(0)
  }

  drawPublished(): Promise<Theme | null> {
    return Promise.resolve(null)
  }

  listPublishedCombinations(): Promise<ThemeCombination[]> {
    return Promise.resolve([])
  }
}

class RecordingThemePoolAudit implements ThemePoolAudit {
  readonly audited: ThemeCombination[] = []

  constructor(private readonly operations: string[]) {}

  record(combination: ThemeCombination): Promise<void> {
    this.audited.push(combination)
    this.operations.push('audit')
    return Promise.resolve()
  }
}

function createHarness() {
  const operations: string[] = []
  const themes = new RecordingThemesRepository(operations)
  const themePoolAudit = new RecordingThemePoolAudit(operations)

  return {
    operations,
    themePoolAudit,
    themes,
    useCase: new WithdrawThemeUseCase({ themes, themePoolAudit }),
  }
}

async function addPublishedTheme(themes: ThemesRepository, id: string): Promise<Theme> {
  const theme = Theme.create({
    id,
    title: ThemeTitle.create(`Theme ${id}`),
    categoryId: 'category-1',
    difficulty: 'balanced',
    createdAt: NOW,
  })
  theme.publish()
  await themes.save(theme)
  return theme
}

describe('WithdrawThemeUseCase', () => {
  it('withdraws the theme and audits the pool of the affected combination', async () => {
    const harness = createHarness()
    await addPublishedTheme(harness.themes, 'theme-1')
    harness.operations.length = 0

    await expect(harness.useCase.execute({ themeId: 'theme-1' })).resolves.toEqual({
      themeId: 'theme-1',
      publicationStatus: 'withdrawn',
    })

    expect(harness.themePoolAudit.audited).toEqual([
      { categoryId: 'category-1', difficulty: 'balanced' },
    ])
  })

  it('audits the pool only after the transition is persisted', async () => {
    const harness = createHarness()
    await addPublishedTheme(harness.themes, 'theme-1')
    harness.operations.length = 0

    await harness.useCase.execute({ themeId: 'theme-1' })

    expect(harness.operations).toEqual(['save', 'audit'])
  })

  it('throws ThemeNotFoundError when the theme does not exist', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute({ themeId: 'missing' })).rejects.toBeInstanceOf(
      ThemeNotFoundError,
    )
    expect(harness.themePoolAudit.audited).toEqual([])
  })

  it('does not persist nor audit when the transition is invalid', async () => {
    const harness = createHarness()
    await addPublishedTheme(harness.themes, 'theme-1')
    await harness.useCase.execute({ themeId: 'theme-1' })
    harness.operations.length = 0

    await expect(harness.useCase.execute({ themeId: 'theme-1' })).rejects.toMatchObject({
      code: 'themes.INVALID_THEME_TRANSITION',
    })
    expect(harness.operations).toEqual([])
  })
})
