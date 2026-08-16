import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import type { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeCategoryNotFoundError } from '@/modules/themes/domain/errors/theme-category-not-found-error/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { CreateThemeUseCase } from './index.js'

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

function createHarness() {
  const themes = new FakeThemesRepository()
  const categories = new FakeThemeCategoriesRepository()
  const eventPublisher = new FakeEventBus()
  let generatedIds = 0

  const useCase = new CreateThemeUseCase({
    themes,
    categories,
    clock: { now: () => NOW },
    eventPublisher,
    idGenerator: { generate: () => `generated-${(generatedIds += 1)}` },
  })

  return { categories, eventPublisher, themes, useCase }
}

async function addCategory(
  harness: ReturnType<typeof createHarness>,
  id: string,
  slug: string,
): Promise<void> {
  await harness.categories.save(
    ThemeCategory.create({ id, slug: CategorySlug.create(slug), name: `Category ${slug}` }),
  )
}

describe('CreateThemeUseCase', () => {
  it('creates a theme in draft and returns a plain DTO', async () => {
    const harness = createHarness()
    await addCategory(harness, 'category-1', 'reflection')

    await expect(
      harness.useCase.execute({
        title: 'How to give feedback',
        categorySlug: 'reflection',
        difficulty: 'balanced',
      }),
    ).resolves.toEqual({
      themeId: 'generated-1',
      title: 'How to give feedback',
      categorySlug: 'reflection',
      difficulty: 'balanced',
      publicationStatus: 'draft',
      createdAt: NOW,
    })
  })

  it('rejects a duplicate title in the same category and publishes the rejection', async () => {
    const harness = createHarness()
    await addCategory(harness, 'category-1', 'reflection')
    await harness.useCase.execute({
      title: 'How to give feedback',
      categorySlug: 'reflection',
      difficulty: 'easy',
    })

    await expect(
      harness.useCase.execute({
        title: ' how  to GIVE feedback ',
        categorySlug: 'reflection',
        difficulty: 'hard',
      }),
    ).rejects.toBeInstanceOf(ThemeTitleAlreadyUsedError)

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'theme_rejected',
        payload: {
          title: ' how  to GIVE feedback ',
          categorySlug: 'reflection',
          difficulty: 'hard',
          issues: [{ field: 'title', reason: 'already used' }],
        },
      }),
    )
  })

  it('accepts the same title in a different category', async () => {
    const harness = createHarness()
    await addCategory(harness, 'category-1', 'reflection')
    await addCategory(harness, 'category-2', 'communication')
    await harness.useCase.execute({
      title: 'How to give feedback',
      categorySlug: 'reflection',
      difficulty: 'easy',
    })

    await expect(
      harness.useCase.execute({
        title: 'How to give feedback',
        categorySlug: 'communication',
        difficulty: 'easy',
      }),
    ).resolves.toMatchObject({ categorySlug: 'communication' })
  })

  it('rejects an unknown category and publishes the rejection', async () => {
    const harness = createHarness()

    await expect(
      harness.useCase.execute({
        title: 'How to give feedback',
        categorySlug: 'unknown-category',
        difficulty: 'easy',
      }),
    ).rejects.toBeInstanceOf(ThemeCategoryNotFoundError)

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'theme_rejected',
        payload: {
          title: 'How to give feedback',
          categorySlug: 'unknown-category',
          difficulty: 'easy',
          issues: [{ field: 'category', reason: 'not found' }],
        },
      }),
    )
  })

  it('publishes a rejection when title validation fails', async () => {
    const harness = createHarness()
    await addCategory(harness, 'category-1', 'reflection')

    await expect(
      harness.useCase.execute({ title: 'no', categorySlug: 'reflection', difficulty: 'easy' }),
    ).rejects.toMatchObject({ code: 'themes.INVALID_THEME_VALUE' })

    expect(harness.eventPublisher.published).toContainEqual(
      expect.objectContaining({
        eventName: 'theme_rejected',
        payload: {
          title: 'no',
          categorySlug: 'reflection',
          difficulty: 'easy',
          issues: [{ field: 'title', reason: 'is invalid' }],
        },
      }),
    )
  })
})
