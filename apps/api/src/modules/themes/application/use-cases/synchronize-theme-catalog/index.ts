import { ThemeCategory } from '@/modules/themes/domain/entities/theme-category/index.js'
import { Theme } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeRejected } from '@/modules/themes/domain/events/theme-rejected/index.js'
import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'
import { ThemeTitleAlreadyUsedError } from '@/modules/themes/domain/errors/theme-title-already-used-error/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/themes/domain/ports/unit-of-work/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import {
  THEME_POOL_MINIMUM,
  ThemePoolMonitor,
} from '@/modules/themes/domain/services/theme-pool-monitor/index.js'
import { CategorySlug } from '@/modules/themes/domain/value-objects/category-slug/index.js'
import { ThemeTitle } from '@/modules/themes/domain/value-objects/theme-title/index.js'

import type {
  SynchronizeThemeCatalogInput,
  SynchronizeThemeCatalogOutput,
  ThemeCatalogCategory,
  ThemeCatalogEntry,
  ThemeCatalogDivergence,
  ThemePoolReport,
} from './types.js'

export interface SynchronizeThemeCatalogDependencies {
  readonly themes: ThemesRepository
  readonly categories: ThemeCategoriesRepository
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}

interface SynchronizeEntryResult {
  readonly synchronized: boolean
  readonly divergence?: ThemeCatalogDivergence
  readonly rejection?: ThemeRejected
}

export class SynchronizeThemeCatalogUseCase {
  constructor(private readonly dependencies: SynchronizeThemeCatalogDependencies) {}

  async execute(input: SynchronizeThemeCatalogInput): Promise<SynchronizeThemeCatalogOutput> {
    const reports: ThemePoolReport[] = []
    const divergences: ThemeCatalogDivergence[] = []
    const rejections: ThemeRejected[] = []

    await this.dependencies.unitOfWork.run(async () => {
      for (const catalogCategory of input.categories) {
        const category = await this.synchronizeCategory(
          catalogCategory.slug,
          catalogCategory.name,
        ).catch((error: unknown) => {
          if (!(error instanceof InvalidThemeValueError) || error.context.field !== 'name') {
            throw error
          }

          rejections.push(...this.rejectCategory(catalogCategory))
          return null
        })
        if (category === null) continue
        const normalizedTitles = new Set<string>()

        for (const entry of catalogCategory.themes) {
          const result = await this.synchronizeEntry(
            category.id,
            category.slug.value,
            entry,
            normalizedTitles,
          )
          if (result.divergence !== undefined) divergences.push(result.divergence)
          if (result.rejection !== undefined) rejections.push(result.rejection)
          if (result.synchronized) {
            reports.push(
              await this.buildPoolReport(category.id, category.slug.value, entry.difficulty),
            )
          }
        }
      }
    })

    const poolReports = this.uniqueReports(reports)

    for (const rejection of rejections) {
      await this.dependencies.eventPublisher.publish(rejection)
    }
    for (const report of poolReports) {
      await this.publishPoolLowAlert(report)
    }

    return { poolReports, divergences }
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
    normalizedTitles: Set<string>,
  ): Promise<SynchronizeEntryResult> {
    try {
      const title = ThemeTitle.create(entry.title)
      if (normalizedTitles.has(title.normalized)) {
        throw new ThemeTitleAlreadyUsedError(categoryId, title.normalized)
      }
      normalizedTitles.add(title.normalized)
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
        return { synchronized: true }
      }

      existing.rename(title)
      existing.changeDifficulty(entry.difficulty)
      if (existing.publicationStatus !== 'withdrawn') {
        this.applyPublicationStatus(existing, entry.publicationStatus)
      } else if (entry.publicationStatus !== 'withdrawn') {
        await this.dependencies.themes.save(existing)
        return {
          synchronized: true,
          divergence: { categorySlug, title: entry.title, reason: 'manual_withdrawal_preserved' },
        }
      }
      await this.dependencies.themes.save(existing)
      return { synchronized: true }
    } catch (error) {
      if (
        !(error instanceof InvalidThemeValueError) &&
        !(error instanceof ThemeTitleAlreadyUsedError)
      ) {
        throw error
      }

      return {
        synchronized: false,
        rejection: ThemeRejected.create({
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
        }),
      }
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
  SynchronizeThemeCatalogOutput,
  ThemeCatalogCategory,
  ThemeCatalogEntry,
  ThemeCatalogDivergence,
  ThemePoolReport,
} from './types.js'
