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
  readonly countQueries: ThemeCombination[] = []
  batchReads = 0
  batchWrites = 0
  batchCounts = 0

  findById(themeId: string): Promise<Theme | null> {
    return Promise.resolve(this.themes.find((theme) => theme.id === themeId) ?? null)
  }

  listByIds(themeIds: readonly string[]): Promise<Theme[]> {
    return Promise.resolve(this.themes.filter((theme) => themeIds.includes(theme.id)))
  }

  listByCategoryIds(categoryIds: readonly string[]): Promise<Theme[]> {
    this.batchReads += 1
    return Promise.resolve(this.themes.filter((theme) => categoryIds.includes(theme.categoryId)))
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

  async saveMany(themes: readonly Theme[]): Promise<void> {
    this.batchWrites += 1
    for (const theme of themes) await this.save(theme)
  }

  countPublishedBy(combination: ThemeCombination): Promise<number> {
    this.countQueries.push(combination)
    return Promise.resolve(
      this.themes.filter(
        (theme) =>
          theme.categoryId === combination.categoryId &&
          theme.difficulty === combination.difficulty &&
          theme.isEligible(),
      ).length,
    )
  }

  async countPublishedByMany(combinations: readonly ThemeCombination[]): Promise<
    readonly {
      readonly categoryId: string
      readonly difficulty: ThemeCombination['difficulty']
      readonly publishedCount: number
    }[]
  > {
    this.batchCounts += 1
    const counts: {
      categoryId: string
      difficulty: ThemeCombination['difficulty']
      publishedCount: number
    }[] = []
    for (const combination of combinations) {
      counts.push({ ...combination, publishedCount: await this.countPublishedBy(combination) })
    }
    return counts
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
  batchReads = 0
  batchWrites = 0

  get categoryCount(): number {
    return this.categories.length
  }

  findById(categoryId: string): Promise<ThemeCategory | null> {
    return Promise.resolve(this.categories.find((category) => category.id === categoryId) ?? null)
  }

  findBySlug(slug: string): Promise<ThemeCategory | null> {
    return Promise.resolve(this.categories.find((category) => category.slug.value === slug) ?? null)
  }

  listBySlugs(slugs: readonly string[]): Promise<ThemeCategory[]> {
    this.batchReads += 1
    return Promise.resolve(
      this.categories.filter((category) => slugs.includes(category.slug.value)),
    )
  }

  save(category: ThemeCategory): Promise<void> {
    const index = this.categories.findIndex((candidate) => candidate.id === category.id)
    if (index === -1) this.categories.push(category)
    else this.categories[index] = category
    return Promise.resolve()
  }

  async saveMany(categories: readonly ThemeCategory[]): Promise<void> {
    this.batchWrites += 1
    for (const category of categories) await this.save(category)
  }

  listWithPublishedThemes(): Promise<ThemeCategory[]> {
    return Promise.resolve([])
  }
}

describe('SynchronizeThemeCatalogUseCase', () => {
  it('normalizes category slugs before loading an existing catalog', async () => {
    const themes = new InMemoryThemesRepository()
    const categories = new FakeThemeCategoriesRepository()
    let id = 0
    const useCase = new SynchronizeThemeCatalogUseCase({
      themes,
      categories,
      eventPublisher: new FakeEventBus(),
      clock: { now: () => new Date('2026-08-16T00:00:00.000Z') },
      idGenerator: { generate: () => `id-${(id += 1)}` },
      unitOfWork: { run: (operation) => operation() },
    })
    const catalog = {
      categories: [
        {
          slug: 'Mindfulness',
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
    await useCase.execute(catalog)

    expect(categories.categoryCount).toBe(1)
    expect(themes.themes).toHaveLength(1)
  })

  it('previews catalog changes without writing or publishing events', async () => {
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

    const result = await useCase.execute(
      {
        categories: [
          {
            slug: 'mindfulness',
            name: 'Mindfulness',
            themes: [
              {
                title: 'Notice the breath',
                difficulty: 'easy',
                publicationStatus: 'published',
              },
            ],
          },
        ],
      },
      { mode: 'preview' },
    )

    expect(result.changes).toEqual({
      categories: { created: 1, updated: 0, unchanged: 0 },
      themes: { created: 1, updated: 0, unchanged: 0 },
    })
    expect(categories.batchWrites).toBe(0)
    expect(themes.batchWrites).toBe(0)
    expect(events.published).toEqual([])
    expect(result.poolReports).toMatchObject([{ publishedCount: 1 }])
  })

  it('reads, writes and counts the catalog through bounded batch operations', async () => {
    const themes = new InMemoryThemesRepository()
    const categories = new FakeThemeCategoriesRepository()
    let id = 0
    const useCase = new SynchronizeThemeCatalogUseCase({
      themes,
      categories,
      eventPublisher: new FakeEventBus(),
      clock: { now: () => new Date('2026-08-16T00:00:00.000Z') },
      idGenerator: { generate: () => `id-${(id += 1)}` },
      unitOfWork: { run: (operation) => operation() },
    })

    await useCase.execute({
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: Array.from({ length: 20 }, (_unused, index) => ({
            title: `Notice the breath ${index + 1}`,
            difficulty: 'easy' as const,
            publicationStatus: 'published' as const,
          })),
        },
      ],
    })

    expect(categories.batchReads).toBe(1)
    expect(categories.batchWrites).toBe(1)
    expect(themes.batchReads).toBe(1)
    expect(themes.batchWrites).toBe(1)
    expect(themes.batchCounts).toBe(1)
  })

  it('counts each catalog pool once after synchronizing all entries', async () => {
    const themes = new InMemoryThemesRepository()
    let id = 0
    const useCase = new SynchronizeThemeCatalogUseCase({
      themes,
      categories: new FakeThemeCategoriesRepository(),
      eventPublisher: new FakeEventBus(),
      clock: { now: () => new Date('2026-08-16T00:00:00.000Z') },
      idGenerator: { generate: () => `id-${(id += 1)}` },
      unitOfWork: { run: (operation) => operation() },
    })

    const result = await useCase.execute({
      categories: [
        {
          slug: 'mindfulness',
          name: 'Mindfulness',
          themes: Array.from({ length: 12 }, (_unused, index) => ({
            title: `Notice the breath ${index + 1}`,
            difficulty: index < 10 ? ('easy' as const) : ('hard' as const),
            publicationStatus: 'published' as const,
          })),
        },
      ],
    })

    expect(themes.countQueries).toHaveLength(2)
    expect(result.poolReports).toHaveLength(2)
  })

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
