import { ThemeCategorySlugNotFoundError } from '@/modules/themes/domain/errors/theme-category-slug-not-found-error/index.js'
import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type { ThemesRepository } from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { ThemePoolMonitor } from '@/modules/themes/domain/services/theme-pool-monitor/index.js'

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
    if (category === null) throw new ThemeCategorySlugNotFoundError(input.categorySlug)

    const combination = { categoryId: category.id, difficulty: input.difficulty }
    const theme = await this.dependencies.themes.drawPublished(combination)
    const publishedCount = await this.dependencies.themes.countPublishedBy(combination)

    const event = ThemePoolMonitor.createLowAlert({
      eventId: this.dependencies.idGenerator.generate(),
      occurredAt: this.dependencies.clock.now(),
      categorySlug: category.slug.value,
      difficulty: input.difficulty,
      publishedCount,
    })
    if (event !== null) await this.dependencies.eventPublisher.publish(event)

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
