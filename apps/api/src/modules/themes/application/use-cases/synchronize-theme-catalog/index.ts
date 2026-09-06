import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeRejected } from '@/modules/themes/domain/events/theme-rejected/index.js'
import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/themes/domain/ports/unit-of-work/index.js'
import type {
  ThemeCatalogCategoriesRepository,
  ThemeCategoriesRepository,
} from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type {
  ThemeCatalogThemesRepository,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import {
  THEME_POOL_MINIMUM,
  ThemePoolMonitor,
} from '@/modules/themes/domain/services/theme-pool-monitor/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import type {
  SynchronizeThemeCatalogInput,
  SynchronizeThemeCatalogOptions,
  SynchronizeThemeCatalogOutput,
  ThemeCatalogCategory,
  ThemeCatalogEntry,
  ThemeCatalogDivergence,
  ThemePoolReport,
} from './types.js'

export interface SynchronizeThemeCatalogDependencies {
  readonly themes: ThemesRepository & ThemeCatalogThemesRepository
  readonly categories: ThemeCategoriesRepository & ThemeCatalogCategoriesRepository
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}

interface SynchronizeEntryResult {
  readonly synchronized: boolean
  readonly theme?: Theme
  readonly change?: ThemeCatalogChange
  readonly divergence?: ThemeCatalogDivergence
  readonly rejection?: ThemeRejected
}

type ThemeCatalogChange = 'created' | 'updated' | 'unchanged'

interface MutableChangeCounts {
  created: number
  updated: number
  unchanged: number
}

interface ThemePoolDescriptor {
  readonly categoryId: string
  readonly categorySlug: string
  readonly difficulty: ThemeCatalogEntry['difficulty']
}

export class SynchronizeThemeCatalogUseCase {
  constructor(private readonly dependencies: SynchronizeThemeCatalogDependencies) {}

  async execute(
    input: SynchronizeThemeCatalogInput,
    options: SynchronizeThemeCatalogOptions = { mode: 'apply' },
  ): Promise<SynchronizeThemeCatalogOutput> {
    const reports: ThemePoolReport[] = []
    const pools = new Map<string, ThemePoolDescriptor>()
    const divergences: ThemeCatalogDivergence[] = []
    const rejections: ThemeRejected[] = []
    const changes: {
      categories: MutableChangeCounts
      themes: MutableChangeCounts
    } = {
      categories: { created: 0, updated: 0, unchanged: 0 },
      themes: { created: 0, updated: 0, unchanged: 0 },
    }

    await this.dependencies.unitOfWork.run(async () => {
      const normalizedCategorySlugs = input.categories.map(
        (category) => CategorySlug.create(category.slug).value,
      )
      const categoriesBySlug = new Map(
        (await this.dependencies.categories.listBySlugs(normalizedCategorySlugs)).map(
          (category) => [category.slug.value, category],
        ),
      )
      const synchronizedCategories = new Map<string, ThemeCategory>()

      for (const [index, catalogCategory] of input.categories.entries()) {
        const normalizedSlug = normalizedCategorySlugs[index]
        if (normalizedSlug === undefined) continue
        const existingCategory = categoriesBySlug.get(normalizedSlug)
        let category: ThemeCategory | null
        try {
          category = this.synchronizeCategory(
            catalogCategory.slug,
            catalogCategory.name,
            existingCategory,
          )
        } catch (error) {
          if (!(error instanceof InvalidThemeValueError) || error.context.field !== 'name') {
            throw error
          }

          rejections.push(...this.rejectCategory(catalogCategory))
          category = null
        }
        if (category === null) continue
        const categoryChange =
          existingCategory === undefined
            ? 'created'
            : existingCategory.name === category.name
              ? 'unchanged'
              : 'updated'
        changes.categories[categoryChange] += 1
        categoriesBySlug.set(category.slug.value, category)
        synchronizedCategories.set(category.slug.value, category)
      }

      if (options.mode === 'apply') {
        await this.dependencies.categories.saveMany([...synchronizedCategories.values()])
      }

      const themesByCombination = new Map(
        (
          await this.dependencies.themes.listByCategoryIds(
            [...synchronizedCategories.values()].map((category) => category.id),
          )
        ).map((theme) => [`${theme.categoryId}:${theme.title.normalized}`, theme]),
      )
      const synchronizedThemes = new Map<string, Theme>()

      for (const [index, catalogCategory] of input.categories.entries()) {
        const normalizedSlug = normalizedCategorySlugs[index]
        if (normalizedSlug === undefined) continue
        const category = synchronizedCategories.get(normalizedSlug)
        if (category === undefined) continue
        const normalizedTitles = new Set<string>()

        for (const entry of catalogCategory.themes) {
          const title = this.createThemeTitle(
            entry,
            category.id,
            category.slug.value,
            normalizedTitles,
          )
          if (title instanceof ThemeRejected) {
            rejections.push(title)
            continue
          }
          const key = `${category.id}:${title.normalized}`
          const result = this.synchronizeEntry(
            category.id,
            category.slug.value,
            entry,
            title,
            themesByCombination.get(key),
          )
          if (result.divergence !== undefined) divergences.push(result.divergence)
          if (result.rejection !== undefined) rejections.push(result.rejection)
          if (result.synchronized && result.theme !== undefined) {
            if (result.change !== undefined) changes.themes[result.change] += 1
            themesByCombination.set(key, result.theme)
            synchronizedThemes.set(key, result.theme)
            pools.set(`${category.id}:${entry.difficulty}`, {
              categoryId: category.id,
              categorySlug: category.slug.value,
              difficulty: entry.difficulty,
            })
          }
        }
      }

      let countsByPool: ReadonlyMap<string, number>
      if (options.mode === 'apply') {
        await this.dependencies.themes.saveMany([...synchronizedThemes.values()])
        const counts = await this.dependencies.themes.countPublishedByMany(
          [...pools.values()].map((pool) => ({
            categoryId: pool.categoryId,
            difficulty: pool.difficulty,
          })),
        )
        countsByPool = new Map(
          counts.map((count) => [`${count.categoryId}:${count.difficulty}`, count.publishedCount]),
        )
      } else {
        countsByPool = this.previewPoolCounts(themesByCombination.values(), pools.values())
      }
      for (const [key, pool] of pools) {
        reports.push({
          categorySlug: pool.categorySlug,
          difficulty: pool.difficulty,
          publishedCount: countsByPool.get(key) ?? 0,
          minimum: THEME_POOL_MINIMUM,
        })
      }
    })

    if (options.mode === 'apply') {
      for (const rejection of rejections) {
        await this.dependencies.eventPublisher.publish(rejection)
      }
      for (const report of reports) {
        await this.publishPoolLowAlert(report)
      }
    }

    return { poolReports: reports, divergences, changes }
  }

  private synchronizeCategory(
    slug: string,
    name: string,
    existing: ThemeCategory | undefined,
  ): ThemeCategory {
    const categorySlug = CategorySlug.create(slug)

    if (existing !== undefined) {
      return ThemeCategory.create({ id: existing.id, slug: existing.slug, name })
    }

    const category = ThemeCategory.create({
      id: this.dependencies.idGenerator.generate(),
      slug: categorySlug,
      name,
    })
    return category
  }

  private createThemeTitle(
    entry: ThemeCatalogEntry,
    categoryId: string,
    categorySlug: string,
    normalizedTitles: Set<string>,
  ): ThemeTitle | ThemeRejected {
    try {
      const title = ThemeTitle.create(entry.title)
      if (normalizedTitles.has(title.normalized)) {
        throw new ThemeTitleAlreadyUsedError(categoryId, title.normalized)
      }
      normalizedTitles.add(title.normalized)
      return title
    } catch (error) {
      if (
        !(error instanceof InvalidThemeValueError) &&
        !(error instanceof ThemeTitleAlreadyUsedError)
      ) {
        throw error
      }

      return this.rejectEntry(entry, categorySlug, error)
    }
  }

  private synchronizeEntry(
    categoryId: string,
    categorySlug: string,
    entry: ThemeCatalogEntry,
    title: ThemeTitle,
    existing: Theme | undefined,
  ): SynchronizeEntryResult {
    try {
      if (existing === undefined) {
        const theme = Theme.create({
          id: this.dependencies.idGenerator.generate(),
          title,
          categoryId,
          difficulty: entry.difficulty,
          createdAt: this.dependencies.clock.now(),
        })
        this.applyPublicationStatus(theme, entry.publicationStatus)
        return { synchronized: true, theme, change: 'created' }
      }

      const theme = Theme.reconstitute({
        id: existing.id,
        title: existing.title,
        categoryId: existing.categoryId,
        difficulty: existing.difficulty,
        publicationStatus: existing.publicationStatus,
        createdAt: existing.createdAt,
      })
      theme.rename(title)
      theme.changeDifficulty(entry.difficulty)
      if (theme.publicationStatus !== 'withdrawn') {
        this.applyPublicationStatus(theme, entry.publicationStatus)
      } else if (entry.publicationStatus !== 'withdrawn') {
        return {
          synchronized: true,
          theme,
          change: this.themeChange(existing, theme),
          divergence: { categorySlug, title: entry.title, reason: 'manual_withdrawal_preserved' },
        }
      }
      return { synchronized: true, theme, change: this.themeChange(existing, theme) }
    } catch (error) {
      if (
        !(error instanceof InvalidThemeValueError) &&
        !(error instanceof ThemeTitleAlreadyUsedError)
      ) {
        throw error
      }

      return {
        synchronized: false,
        rejection: this.rejectEntry(entry, categorySlug, error),
      }
    }
  }

  private themeChange(existing: Theme, synchronized: Theme): ThemeCatalogChange {
    return existing.title.value === synchronized.title.value &&
      existing.difficulty === synchronized.difficulty &&
      existing.publicationStatus === synchronized.publicationStatus
      ? 'unchanged'
      : 'updated'
  }

  private previewPoolCounts(
    themes: Iterable<Theme>,
    pools: Iterable<ThemePoolDescriptor>,
  ): ReadonlyMap<string, number> {
    const counts = new Map<string, number>()
    const poolKeys = new Set([...pools].map((pool) => `${pool.categoryId}:${pool.difficulty}`))
    for (const theme of themes) {
      const key = `${theme.categoryId}:${theme.difficulty}`
      if (poolKeys.has(key) && theme.isEligible()) {
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
    }
    return counts
  }

  private rejectEntry(
    entry: ThemeCatalogEntry,
    categorySlug: string,
    error: InvalidThemeValueError | ThemeTitleAlreadyUsedError,
  ): ThemeRejected {
    return ThemeRejected.create({
      eventId: this.dependencies.idGenerator.generate(),
      occurredAt: this.dependencies.clock.now(),
      title: entry.title,
      categorySlug,
      difficulty: entry.difficulty,
      issues: [
        {
          field: 'title',
          reason: error instanceof ThemeTitleAlreadyUsedError ? 'already used' : 'is invalid',
        },
      ],
    })
  }

  private applyPublicationStatus(
    theme: Theme,
    publicationStatus: ThemeCatalogEntry['publicationStatus'],
  ): void {
    if (theme.publicationStatus === publicationStatus) return
    if (publicationStatus === 'published') theme.publish()
    if (publicationStatus === 'withdrawn') theme.withdraw()
    if (publicationStatus === 'draft') theme.moveToDraft()
  }

  private async publishPoolLowAlert(report: ThemePoolReport): Promise<void> {
    const event = ThemePoolMonitor.createLowAlert({
      eventId: this.dependencies.idGenerator.generate(),
      occurredAt: this.dependencies.clock.now(),
      categorySlug: report.categorySlug,
      difficulty: report.difficulty,
      publishedCount: report.publishedCount,
    })
    if (event !== null) await this.dependencies.eventPublisher.publish(event)
  }

  private rejectCategory(catalogCategory: ThemeCatalogCategory): ThemeRejected[] {
    return catalogCategory.themes.map((entry) =>
      ThemeRejected.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: this.dependencies.clock.now(),
        title: entry.title,
        categorySlug: catalogCategory.slug,
        difficulty: entry.difficulty,
        issues: [{ field: 'name', reason: 'is invalid' }],
      }),
    )
  }
}

export type {
  SynchronizeThemeCatalogInput,
  SynchronizeThemeCatalogOptions,
  SynchronizeThemeCatalogOutput,
  ThemeCatalogChanges,
  ThemeCatalogCategory,
  ThemeCatalogEntry,
  ThemeCatalogDivergence,
  ThemePoolReport,
} from './types.js'
