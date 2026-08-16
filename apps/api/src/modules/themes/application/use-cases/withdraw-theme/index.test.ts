import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { InvalidThemeTransitionError } from '@/modules/themes/domain/errors/invalid-theme-transition-error/index.js'
import { ThemeNotFoundError } from '@/modules/themes/domain/errors/theme-not-found-error/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { PublishThemeUseCase } from '../publish-theme/index.js'
import { MoveThemeToDraftUseCase } from '../move-theme-to-draft/index.js'
import { WithdrawThemeUseCase } from './index.js'

const NOW = new Date('2026-08-16T12:00:00.000Z')

class CountAfterSaveThemesRepository implements ThemesRepository {
  private readonly themes: Theme[] = []
  readonly operations: string[] = []

  findById(themeId: string): Promise<Theme | null> {
    return Promise.resolve(this.themes.find((theme) => theme.id === themeId) ?? null)
  }

  findByNormalizedTitle(params: {
    categoryId: string
    normalizedTitle: string
  }): Promise<Theme | null> {
    return Promise.resolve(
      this.themes.find(
        (theme) =>
          theme.categoryId === params.categoryId &&
          theme.title.normalized === params.normalizedTitle,
      ) ?? null,
    )
  }

  save(theme: Theme): Promise<void> {
    const index = this.themes.findIndex((candidate) => candidate.id === theme.id)
    if (index === -1) this.themes.push(theme)
    else this.themes[index] = theme
    this.operations.push('save')
    return Promise.resolve()
  }

  countPublishedBy(combination: ThemeCombination): Promise<number> {
    this.operations.push('countPublishedBy')

    return Promise.resolve(
      this.themes.filter(
        (theme) =>
          theme.categoryId === combination.categoryId &&
          theme.difficulty === combination.difficulty &&
          theme.isEligible(),
      ).length,
    )
  }

  drawPublished(combination: ThemeCombination): Promise<Theme | null> {
    return Promise.resolve(
      this.themes.find(
        (theme) =>
          theme.categoryId === combination.categoryId &&
          theme.difficulty === combination.difficulty &&
          theme.isEligible(),
      ) ?? null,
    )
  }

  listPublishedCombinations(): Promise<ThemeCombination[]> {
    return Promise.resolve([])
  }
}

class FakeThemeCategoriesRepository implements ThemeCategoriesRepository {
  readonly categories: ThemeCategory[] = []

  findById(categoryId: string): Promise<ThemeCategory | null> {
    return Promise.resolve(this.categories.find((category) => category.id === categoryId) ?? null)
  }

  findBySlug(slug: string): Promise<ThemeCategory | null> {
    return Promise.resolve(this.categories.find((category) => category.slug.value === slug) ?? null)
  }

  save(category: ThemeCategory): Promise<void> {
    const index = this.categories.findIndex((candidate) => candidate.id === category.id)
    if (index === -1) this.categories.push(category)
    else this.categories[index] = category
    return Promise.resolve()
  }

  listWithPublishedThemes(): Promise<ThemeCategory[]> {
    return Promise.resolve([])
  }
}

function createTheme(id: string): Theme {
  return Theme.create({
    id,
    title: ThemeTitle.create(`Theme ${id}`),
    categoryId: 'category-1',
    difficulty: 'balanced',
    createdAt: NOW,
  })
}

function createHarness() {
  const themes = new CountAfterSaveThemesRepository()
  const categories = new FakeThemeCategoriesRepository()
  const eventPublisher = new FakeEventBus()
  let generatedIds = 0
  const useCase = new WithdrawThemeUseCase({
    themes,
    categories,
    eventPublisher,
    clock: { now: () => NOW },
    idGenerator: { generate: () => `event-${(generatedIds += 1)}` },
  })
  const publishTheme = new PublishThemeUseCase({
    themes,
    categories,
    eventPublisher,
    clock: { now: () => NOW },
    idGenerator: { generate: () => `event-${(generatedIds += 1)}` },
  })
  const moveThemeToDraft = new MoveThemeToDraftUseCase({
    themes,
    categories,
    eventPublisher,
    clock: { now: () => NOW },
    idGenerator: { generate: () => `event-${(generatedIds += 1)}` },
  })

  return { categories, eventPublisher, moveThemeToDraft, publishTheme, themes, useCase }
}

async function addPublishedTheme(themes: ThemesRepository, id: string): Promise<Theme> {
  const theme = createTheme(id)
  theme.publish()
  await themes.save(theme)
  return theme
}

async function addCategory(harness: ReturnType<typeof createHarness>): Promise<void> {
  await harness.categories.save(
    ThemeCategory.create({
      id: 'category-1',
      slug: CategorySlug.create('reflection'),
      name: 'Reflection',
    }),
  )
}

describe('WithdrawThemeUseCase', () => {
  it('publishes theme_pool_low after withdrawing the tenth published theme', async () => {
    const harness = createHarness()
    await addCategory(harness)

    for (let index = 1; index <= 10; index += 1) {
      await addPublishedTheme(harness.themes, `theme-${index}`)
    }

    await expect(harness.useCase.execute({ themeId: 'theme-10' })).resolves.toEqual({
      themeId: 'theme-10',
      publicationStatus: 'withdrawn',
    })

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'theme_pool_low',
        payload: {
          categorySlug: 'reflection',
          difficulty: 'balanced',
          publishedCount: 9,
          minimum: 10,
        },
      }),
    )
    expect(harness.themes.operations.slice(-2)).toEqual(['save', 'countPublishedBy'])
  })

  it('does not publish theme_pool_low when ten or more themes remain published', async () => {
    const harness = createHarness()
    await addCategory(harness)

    for (let index = 1; index <= 11; index += 1) {
      await addPublishedTheme(harness.themes, `theme-${index}`)
    }

    await harness.useCase.execute({ themeId: 'theme-11' })

    expect(harness.eventPublisher.published).toHaveLength(0)
  })

  it('returns a republished withdrawn theme to the eligible draw', async () => {
    const harness = createHarness()
    await addCategory(harness)
    const theme = await addPublishedTheme(harness.themes, 'theme-1')

    await harness.useCase.execute({ themeId: theme.id })

    expect(
      await harness.themes.drawPublished({ categoryId: 'category-1', difficulty: 'balanced' }),
    ).toBeNull()

    await harness.publishTheme.execute({ themeId: theme.id })

    await expect(
      harness.themes.drawPublished({ categoryId: 'category-1', difficulty: 'balanced' }),
    ).resolves.toMatchObject({ id: theme.id, publicationStatus: 'published' })
  })

  it('throws ThemeNotFoundError when the theme does not exist', async () => {
    const harness = createHarness()

    await expect(harness.useCase.execute({ themeId: 'missing' })).rejects.toBeInstanceOf(
      ThemeNotFoundError,
    )
  })

  it('does not persist when the transition is invalid', async () => {
    const harness = createHarness()
    await addCategory(harness)
    const theme = await addPublishedTheme(harness.themes, 'theme-1')
    await harness.useCase.execute({ themeId: theme.id })

    await expect(harness.moveThemeToDraft.execute({ themeId: theme.id })).rejects.toBeInstanceOf(
      InvalidThemeTransitionError,
    )

    expect((await harness.themes.findById(theme.id))?.publicationStatus).toBe('withdrawn')
  })
})
