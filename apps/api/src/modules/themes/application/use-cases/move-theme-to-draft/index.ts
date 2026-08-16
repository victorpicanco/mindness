import { ThemePoolLow } from '@/modules/themes/domain/events/theme-pool-low/index.js'
import type { ThemeDifficulty } from '@/modules/themes/domain/entities/theme/index.js'
import { ThemeCategoryNotFoundError } from '@/modules/themes/domain/errors/theme-category-not-found-error/index.js'
import { ThemeNotFoundError } from '@/modules/themes/domain/errors/theme-not-found-error/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import {
  THEME_POOL_MINIMUM,
  ThemePoolMonitor,
} from '@/modules/themes/domain/services/theme-pool-monitor/index.js'

import type { MoveThemeToDraftInput, MoveThemeToDraftOutput } from './types.js'

export interface MoveThemeToDraftDependencies {
  readonly themes: ThemesRepository
  readonly categories: ThemeCategoriesRepository
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
}

export class MoveThemeToDraftUseCase {
  constructor(private readonly dependencies: MoveThemeToDraftDependencies) {}

  async execute(input: MoveThemeToDraftInput): Promise<MoveThemeToDraftOutput> {
    const theme = await this.dependencies.themes.findById(input.themeId)
    if (theme === null) throw new ThemeNotFoundError(input.themeId)

    theme.moveToDraft()
    await this.dependencies.themes.save(theme)
    await this.publishPoolLowAlert(theme.categoryId, theme.difficulty)

    return { themeId: theme.id, publicationStatus: theme.publicationStatus }
  }

  private async publishPoolLowAlert(
    categoryId: string,
    difficulty: ThemeDifficulty,
  ): Promise<void> {
    const publishedCount = await this.dependencies.themes.countPublishedBy({
      categoryId,
      difficulty,
    })
    if (ThemePoolMonitor.evaluate(publishedCount) === 'healthy') return

    const category = await this.dependencies.categories.findById(categoryId)
    if (category === null) throw new ThemeCategoryNotFoundError(categoryId)

    await this.dependencies.eventPublisher.publish(
      ThemePoolLow.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: this.dependencies.clock.now(),
        categorySlug: category.slug.value,
        difficulty,
        publishedCount,
        minimum: THEME_POOL_MINIMUM,
      }),
    )
  }
}

export type { MoveThemeToDraftInput, MoveThemeToDraftOutput } from './types.js'
