import type { Clock } from '@/modules/themes/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/themes/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/themes/domain/ports/id-generator/index.js'
import type { ThemePoolAudit } from '@/modules/themes/domain/ports/theme-pool-audit/index.js'
import type { ThemeCategoriesRepository } from '@/modules/themes/domain/repositories/theme-categories-repository/index.js'
import type {
  ThemeCombination,
  ThemesRepository,
} from '@/modules/themes/domain/repositories/themes-repository/index.js'
import { ThemePoolMonitor } from '@/modules/themes/domain/services/theme-pool-monitor/index.js'

export interface ThemePoolAuditAdapterDependencies {
  readonly themes: ThemesRepository
  readonly categories: ThemeCategoriesRepository
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
}

export class ThemePoolAuditAdapter implements ThemePoolAudit {
  constructor(private readonly dependencies: ThemePoolAuditAdapterDependencies) {}

  async record(combination: ThemeCombination): Promise<void> {
    const publishedCount = await this.dependencies.themes.countPublishedBy(combination)
    const category = await this.dependencies.categories.findById(combination.categoryId)
    if (category === null) return

    const event = ThemePoolMonitor.createLowAlert({
      eventId: this.dependencies.idGenerator.generate(),
      occurredAt: this.dependencies.clock.now(),
      categorySlug: category.slug.value,
      difficulty: combination.difficulty,
      publishedCount,
    })
    if (event === null) return

    await this.dependencies.eventPublisher.publish(event)
  }
}
