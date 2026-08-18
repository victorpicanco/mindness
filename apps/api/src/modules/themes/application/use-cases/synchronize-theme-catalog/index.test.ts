import { describe, expect, it } from 'vitest'

import type { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import type { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'

import { SynchronizeThemeCatalogUseCase } from './index.js'

class InMemoryThemesRepository implements ThemesRepository {
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

  drawPublished(): Promise<Theme | null> {
    return Promise.resolve(null)
  }

  listPublishedCombinations(): Promise<ThemeCombination[]> {
    return Promise.resolve([])
  }
}

class FakeThemeCategoriesRepository implements ThemeCategoriesRepository {
  private readonly categories: ThemeCategory[] = []

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

describe('SynchronizeThemeCatalogUseCase', () => {
  it('is idempotent and preserves a theme withdrawn manually', async () => {
    const themes = new InMemoryThemesRepository()
    const categories = new FakeThemeCategoriesRepository()
    const events = new FakeEventBus()
    let id = 0
    const useCase = new SynchronizeThemeCatalogUseCase({
      themes,
      categories,
      eventPublisher: events,
      clock: { now: () => new Date('2026-08-16T00:00:00.000Z') },
      idGenerator: { generate: () => `id-${(id += 1)}` },
      unitOfWork: { run: (operation) => operation() },
    })
    const catalog = {
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            {
              title: 'Notice the breath',
              difficulty: 'easy' as const,
              publicationStatus: 'published' as const,
            },
          ],
        },
      ],
    }

    await useCase.execute(catalog)
    const theme = themes.themes[0]
    expect(theme).toBeDefined()
    if (theme === undefined) return
    theme.withdraw()
    await themes.save(theme)

    await expect(useCase.execute(catalog)).resolves.toMatchObject({
      divergences: [
        {
          categorySlug: 'mindfulness',
          title: 'Notice the breath',
          reason: 'manual_withdrawal_preserved',
        },
      ],
    })
    expect(themes.themes).toHaveLength(1)
    expect(theme.publicationStatus).toBe('withdrawn')
  })

  it('publishes every event only after the transaction commits', async () => {
    const operations: string[] = []
    let id = 0
    const useCase = new SynchronizeThemeCatalogUseCase({
      themes: new InMemoryThemesRepository(),
      categories: new FakeThemeCategoriesRepository(),
      eventPublisher: {
        publish: () => {
          operations.push('publish')
          return Promise.resolve()
        },
      },
      clock: { now: () => new Date('2026-08-16T00:00:00.000Z') },
      idGenerator: { generate: () => `id-${(id += 1)}` },
      unitOfWork: {
        run: async (operation) => {
          operations.push('transaction:begin')
          const result = await operation()
          operations.push('transaction:commit')
          return result
        },
      },
    })

    await useCase.execute({
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            { title: ' ', difficulty: 'easy', publicationStatus: 'published' },
            { title: 'Notice the breath', difficulty: 'easy', publicationStatus: 'published' },
          ],
        },
      ],
    })

    expect(operations).toEqual(['transaction:begin', 'transaction:commit', 'publish', 'publish'])
  })

  it('rejects an invalid title while synchronizing valid entries', async () => {
    const themes = new InMemoryThemesRepository()
    const events = new FakeEventBus()
    let id = 0
    const useCase = new SynchronizeThemeCatalogUseCase({
      themes,
      categories: new FakeThemeCategoriesRepository(),
      eventPublisher: events,
      clock: { now: () => new Date('2026-08-16T00:00:00.000Z') },
      idGenerator: { generate: () => `id-${(id += 1)}` },
      unitOfWork: { run: (operation) => operation() },
    })

    await useCase.execute({
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: [
            { title: ' ', difficulty: 'easy', publicationStatus: 'published' },
            { title: 'Notice the breath', difficulty: 'easy', publicationStatus: 'published' },
          ],
        },
      ],
    })

    expect(themes.themes).toHaveLength(1)
    expect(events.published).toContainEqual(
      expect.objectContaining({ eventName: 'theme_rejected' }),
    )
  })
})
