import { describe, expect, it } from 'vitest'

import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { THEME_POOL_MINIMUM } from '@/modules/themes/domain/services/theme-pool-monitor/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { ThemePoolAuditAdapter } from './index.js'

const NOW = new Date('2026-08-16T12:00:00.000Z')
const COMBINATION: ThemeCombination = { categoryId: 'category-1', difficulty: 'balanced' }

function themesRepositoryReturning(publishedCount: number): ThemesRepository {
  return {
    findById: () => Promise.resolve(null),
    findByNormalizedTitle: () => Promise.resolve(null),
    save: () => Promise.resolve(),
    countPublishedBy: () => Promise.resolve(publishedCount),
    drawPublished: () => Promise.resolve(null),
    listPublishedCombinations: () => Promise.resolve([]),
  }
}

function categoriesRepositoryReturning(category: ThemeCategory | null): ThemeCategoriesRepository {
  return {
    findById: () => Promise.resolve(category),
    findBySlug: () => Promise.resolve(category),
    save: () => Promise.resolve(),
    listWithPublishedThemes: () => Promise.resolve([]),
  }
}

function reflectionCategory(): ThemeCategory {
  return ThemeCategory.create({
    id: 'category-1',
    slug: CategorySlug.create('reflection'),
    name: 'Reflection',
  })
}

function createAdapter(params: { publishedCount: number; category: ThemeCategory | null }): {
  adapter: ThemePoolAuditAdapter
  eventPublisher: FakeEventBus
} {
  const eventPublisher = new FakeEventBus()
  const adapter = new ThemePoolAuditAdapter({
    themes: themesRepositoryReturning(params.publishedCount),
    categories: categoriesRepositoryReturning(params.category),
    clock: { now: () => NOW },
    idGenerator: { generate: () => 'event-1' },
    eventPublisher,
  })

  return { adapter, eventPublisher }
}

describe('ThemePoolAuditAdapter', () => {
  it('publishes theme_pool_low when the combination is below the minimum', async () => {
    const { adapter, eventPublisher } = createAdapter({
      publishedCount: THEME_POOL_MINIMUM - 1,
      category: reflectionCategory(),
    })

    await adapter.record(COMBINATION)

    expect(eventPublisher.published).toEqual([
      expect.objectContaining({
        eventName: 'theme_pool_low',
        eventId: 'event-1',
        occurredAt: NOW,
        payload: {
          categorySlug: 'reflection',
          difficulty: 'balanced',
          publishedCount: THEME_POOL_MINIMUM - 1,
          minimum: THEME_POOL_MINIMUM,
        },
      }),
    ])
  })

  it('stays silent when the combination is healthy', async () => {
    const { adapter, eventPublisher } = createAdapter({
      publishedCount: THEME_POOL_MINIMUM,
      category: reflectionCategory(),
    })

    await adapter.record(COMBINATION)

    expect(eventPublisher.published).toEqual([])
  })

  it('stays silent when the category no longer exists', async () => {
    const { adapter, eventPublisher } = createAdapter({ publishedCount: 0, category: null })

    await adapter.record(COMBINATION)

    expect(eventPublisher.published).toEqual([])
  })
})
