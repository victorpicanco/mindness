import type { ThemeDifficulty } from '@/modules/themes/domain/entities/theme/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const THEME_POOL_LOW = 'theme_pool_low'
const THEME_POOL_LOW_VERSION = 1

export interface ThemePoolLowPayload {
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
  readonly publishedCount: number
  readonly minimum: number
}

export interface CreateThemePoolLowParams {
  readonly eventId: string
  readonly occurredAt: Date
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
  readonly publishedCount: number
  readonly minimum: number
}

export class ThemePoolLow implements IntegrationEvent<typeof THEME_POOL_LOW, ThemePoolLowPayload> {
  readonly eventName = THEME_POOL_LOW
  readonly version = THEME_POOL_LOW_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: ThemePoolLowPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateThemePoolLowParams): ThemePoolLow {
    return new ThemePoolLow(params.eventId, params.occurredAt.getTime(), {
      categorySlug: params.categorySlug,
      difficulty: params.difficulty,
      publishedCount: params.publishedCount,
      minimum: params.minimum,
    })
  }
}
