import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeRejected } from '@/modules/themes/domain/events/theme-rejected/index.js'
import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { THEME_POOL_MINIMUM } from '@/modules/themes/domain/services/theme-pool-monitor/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import type {
  SynchronizeThemeCatalogInput,
  SynchronizeThemeCatalogOutput,
  ThemeCatalogEntry,
  ThemePoolReport,
} from './types.js'

export interface SynchronizeThemeCatalogDependencies {
  readonly themes: ThemesRepository
  readonly categories: ThemeCategoriesRepository
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
}

export class SynchronizeThemeCatalogUseCase {
  constructor(private readonly dependencies: SynchronizeThemeCatalogDependencies) {}

  async execute(input: SynchronizeThemeCatalogInput): Promise<SynchronizeThemeCatalogOutput> {
    const reports: ThemePoolReport[] = []

    for (const catalogCategory of input.categories) {
      const category = await this.synchronizeCategory(catalogCategory.slug, catalogCategory.name)

      for (const entry of catalogCategory.themes) {
        await this.synchronizeEntry(category.id, category.slug.value, entry)
        reports.push(await this.buildPoolReport(category.id, category.slug.value, entry.difficulty))
      }
    }

    return { poolReports: this.uniqueReports(reports) }
  }

  private async synchronizeCategory(slug: string, name: string): Promise<ThemeCategory> {
    const categorySlug = CategorySlug.create(slug)
    const existing = await this.dependencies.categories.findBySlug(categorySlug.value)

    if (existing !== null) {
      existing.rename(name)
      await this.dependencies.categories.save(existing)
      return existing
    }

    const category = ThemeCategory.create({
      id: this.dependencies.idGenerator.generate(),
      slug: categorySlug,
      name,
    })
    await this.dependencies.categories.save(category)
    return category
  }

  private async synchronizeEntry(
    categoryId: string,
    categorySlug: string,
    entry: ThemeCatalogEntry,
  ): Promise<void> {
    try {
      const title = ThemeTitle.create(entry.title)
      const existing = await this.dependencies.themes.findByNormalizedTitle({
        categoryId,
        normalizedTitle: title.normalized,
      })

      if (existing === null) {
        const theme = Theme.create({
          id: this.dependencies.idGenerator.generate(),
          title,
          categoryId,
          difficulty: entry.difficulty,
          createdAt: this.dependencies.clock.now(),
        })
        this.applyPublicationStatus(theme, entry.publicationStatus)
        await this.dependencies.themes.save(theme)
        return
      }

      existing.rename(title)
      if (existing.publicationStatus !== 'withdrawn') {
        this.applyPublicationStatus(existing, entry.publicationStatus)
      }
      await this.dependencies.themes.save(existing)
    } catch (error) {
      if (!(error instanceof InvalidThemeValueError)) throw error

      await this.dependencies.eventPublisher.publish(
        ThemeRejected.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: this.dependencies.clock.now(),
          title: entry.title,
          categorySlug,
          difficulty: entry.difficulty,
          issues: [
            { field: error.context.field === 'name' ? 'name' : 'title', reason: 'is invalid' },
          ],
        }),
      )
    }
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

  private async buildPoolReport(
    categoryId: string,
    categorySlug: string,
    difficulty: ThemeCatalogEntry['difficulty'],
  ): Promise<ThemePoolReport> {
    return {
      categorySlug,
      difficulty,
      publishedCount: await this.dependencies.themes.countPublishedBy({ categoryId, difficulty }),
      minimum: THEME_POOL_MINIMUM,
    }
  }

  private uniqueReports(reports: readonly ThemePoolReport[]): readonly ThemePoolReport[] {
    const reportsByCombination = new Map<string, ThemePoolReport>()
    for (const report of reports) {
      reportsByCombination.set(`${report.categorySlug}:${report.difficulty}`, report)
    }
    return [...reportsByCombination.values()]
  }
}

export type {
  SynchronizeThemeCatalogInput,
  SynchronizeThemeCatalogOutput,
  ThemeCatalogCategory,
  ThemeCatalogEntry,
  ThemePoolReport,
} from './types.js'
