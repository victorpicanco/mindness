import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeCategorySlugNotFoundError } from '@/modules/themes/domain/errors/theme-category-slug-not-found-error/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { DrawEligibleThemeUseCase } from './index.js'

const NOW = new Date('2026-08-16T12:00:00.000Z')

class FakeThemesRepository implements ThemesRepository {
  readonly themes: Theme[] = []

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
    return Promise.resolve()
  }

  countPublishedBy(combination: ThemeCombination): Promise<number> {
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

function createTheme(params: {
  id: string
  categoryId: string
  title: string
  difficulty: 'easy' | 'balanced' | 'hard'
}): Theme {
  return Theme.create({ ...params, title: ThemeTitle.create(params.title), createdAt: NOW })
}

function createHarness() {
  const themes = new FakeThemesRepository()
  const categories = new FakeThemeCategoriesRepository()
  const eventPublisher = new FakeEventBus()
  let generatedIds = 0
  const useCase = new DrawEligibleThemeUseCase({
    themes,
    categories,
    eventPublisher,
    clock: { now: () => NOW },
    idGenerator: { generate: () => `event-${(generatedIds += 1)}` },
  })

  return { categories, eventPublisher, themes, useCase }
}

async function addCategory(
  harness: ReturnType<typeof createHarness>,
  params: { id: string; slug: string; name: string },
): Promise<void> {
  await harness.categories.save(
    ThemeCategory.create({
      id: params.id,
      slug: CategorySlug.create(params.slug),
      name: params.name,
    }),
  )
}

describe('DrawEligibleThemeUseCase', () => {
  it('returns only a published theme from the requested category and difficulty', async () => {
    const harness = createHarness()
    await addCategory(harness, { id: 'reflection', slug: 'reflection', name: 'Reflection' })
    await addCategory(harness, { id: 'focus', slug: 'focus', name: 'Focus' })

    const eligibleTheme = createTheme({
      id: 'eligible-theme',
      categoryId: 'reflection',
      title: 'Observe your thoughts',
      difficulty: 'balanced',
    })
    eligibleTheme.publish()
    await harness.themes.save(eligibleTheme)

    const differentDifficulty = createTheme({
      id: 'hard-theme',
      categoryId: 'reflection',
      title: 'Name every thought',
      difficulty: 'hard',
    })
    differentDifficulty.publish()
    await harness.themes.save(differentDifficulty)

    const differentCategory = createTheme({
      id: 'focus-theme',
      categoryId: 'focus',
      title: 'Follow your breath',
      difficulty: 'balanced',
    })
    differentCategory.publish()
    await harness.themes.save(differentCategory)

    await expect(
      harness.useCase.execute({ categorySlug: 'reflection', difficulty: 'balanced' }),
    ).resolves.toEqual({
      themeId: 'eligible-theme',
      title: 'Observe your thoughts',
      categorySlug: 'reflection',
      difficulty: 'balanced',
    })
  })

  it('ignores draft and withdrawn themes', async () => {
    const harness = createHarness()
    await addCategory(harness, { id: 'reflection', slug: 'reflection', name: 'Reflection' })

    const draftTheme = createTheme({
      id: 'draft-theme',
      categoryId: 'reflection',
      title: 'Write your thoughts',
      difficulty: 'easy',
    })
    await harness.themes.save(draftTheme)

    const withdrawnTheme = createTheme({
      id: 'withdrawn-theme',
      categoryId: 'reflection',
      title: 'Observe a sensation',
      difficulty: 'easy',
    })
    withdrawnTheme.withdraw()
    await harness.themes.save(withdrawnTheme)

    await expect(
      harness.useCase.execute({ categorySlug: 'reflection', difficulty: 'easy' }),
    ).resolves.toBeNull()
  })

  it('returns null and publishes theme_pool_low when the requested combination is empty', async () => {
    const harness = createHarness()
    await addCategory(harness, { id: 'reflection', slug: 'reflection', name: 'Reflection' })

    await expect(
      harness.useCase.execute({ categorySlug: 'reflection', difficulty: 'hard' }),
    ).resolves.toBeNull()

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'theme_pool_low',
        payload: {
          categorySlug: 'reflection',
          difficulty: 'hard',
          publishedCount: 0,
          minimum: 10,
        },
      }),
    )
  })

  it('throws ThemeCategorySlugNotFoundError when the category does not exist', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({ categorySlug: 'missing', difficulty: 'balanced' }),
    ).rejects.toBeInstanceOf(ThemeCategorySlugNotFoundError)
    await expect(
      harness.useCase.execute({ categorySlug: 'missing', difficulty: 'balanced' }),
    ).rejects.toMatchObject({ context: { categorySlug: 'missing' } })
  })
})
