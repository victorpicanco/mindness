import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { ThemeCategoryNotFoundError } from '@/modules/themes/domain/errors/theme-category-not-found-error/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { InMemoryThemeCategoriesRepository } from '@/modules/themes/infrastructure/repositories/in-memory-theme-categories-repository/index.js'
import { InMemoryThemesRepository } from '@/modules/themes/infrastructure/repositories/in-memory-themes-repository/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { CreateThemeUseCase } from './index.js'

const NOW = new Date('2026-08-16T12:00:00.000Z')

function createHarness() {
  const themes = new InMemoryThemesRepository()
  const categories = new InMemoryThemeCategoriesRepository(themes)
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
