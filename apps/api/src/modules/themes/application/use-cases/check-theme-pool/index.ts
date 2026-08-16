import { ThemePoolLow } from '@/modules/themes/domain/events/theme-pool-low/index.js'
import { ThemeCategoryNotFoundError } from '@/modules/themes/domain/errors/theme-category-not-found-error/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import {
  THEME_POOL_MINIMUM,
  ThemePoolMonitor,
} from '@/modules/themes/domain/services/theme-pool-monitor/index.js'

import type { CheckThemePoolOutput } from './types.js'

export interface CheckThemePoolDependencies {
  readonly themes: ThemesRepository
  readonly categories: ThemeCategoriesRepository
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
}

export class CheckThemePoolUseCase {
  constructor(private readonly dependencies: CheckThemePoolDependencies) {}

  async execute(): Promise<CheckThemePoolOutput> {
    const combinations = await this.dependencies.themes.listPublishedCombinations()

    for (const combination of combinations) {
      await this.publishLowPoolAlert(combination)
    }
  }

  private async publishLowPoolAlert(combination: ThemeCombination): Promise<void> {
    const publishedCount = await this.dependencies.themes.countPublishedBy(combination)
    if (ThemePoolMonitor.evaluate(publishedCount) === 'healthy') return

    const category = await this.dependencies.categories.findById(combination.categoryId)
    if (category === null) throw new ThemeCategoryNotFoundError(combination.categoryId)

    await this.dependencies.eventPublisher.publish(
      ThemePoolLow.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: this.dependencies.clock.now(),
        categorySlug: category.slug.value,
        difficulty: combination.difficulty,
        publishedCount,
        minimum: THEME_POOL_MINIMUM,
      }),
    )
  }
}

export type { CheckThemePoolOutput } from './types.js'
