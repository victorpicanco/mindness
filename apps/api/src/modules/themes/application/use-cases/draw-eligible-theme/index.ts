import { ThemePoolLow } from '@/modules/themes/domain/events/theme-pool-low/index.js'
import { ThemeCategoryNotFoundError } from '@/modules/themes/domain/errors/theme-category-not-found-error/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import {
  THEME_POOL_MINIMUM,
  ThemePoolMonitor,
} from '@/modules/themes/domain/services/theme-pool-monitor/index.js'

import type { DrawEligibleThemeInput, DrawEligibleThemeOutput } from './types.js'

export interface DrawEligibleThemeDependencies {
  readonly themes: ThemesRepository
  readonly categories: ThemeCategoriesRepository
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
}

export class DrawEligibleThemeUseCase {
  constructor(private readonly dependencies: DrawEligibleThemeDependencies) {}

  async execute(input: DrawEligibleThemeInput): Promise<DrawEligibleThemeOutput | null> {
    const category = await this.dependencies.categories.findBySlug(input.categorySlug)
    if (category === null) throw new ThemeCategoryNotFoundError(input.categorySlug)

    const combination = { categoryId: category.id, difficulty: input.difficulty }
    const theme = await this.dependencies.themes.drawPublished(combination)
    const publishedCount = await this.dependencies.themes.countPublishedBy(combination)

    if (ThemePoolMonitor.evaluate(publishedCount) !== 'healthy') {
      await this.dependencies.eventPublisher.publish(
        ThemePoolLow.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: this.dependencies.clock.now(),
          categorySlug: category.slug.value,
          difficulty: input.difficulty,
          publishedCount,
          minimum: THEME_POOL_MINIMUM,
        }),
      )
    }

    if (theme === null) return null

    return {
      themeId: theme.id,
      title: theme.title.value,
      categorySlug: category.slug.value,
      difficulty: theme.difficulty,
    }
  }
}

export type { DrawEligibleThemeInput, DrawEligibleThemeOutput } from './types.js'
