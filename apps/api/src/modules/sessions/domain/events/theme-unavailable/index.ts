import type { SessionDifficulty } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const THEME_UNAVAILABLE = 'theme_unavailable'
const THEME_UNAVAILABLE_VERSION = 1

export interface ThemeUnavailablePayload {
  readonly accountId: string
  readonly categorySlug: string
  readonly difficulty: SessionDifficulty
}

export interface CreateThemeUnavailableParams extends ThemeUnavailablePayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class ThemeUnavailable implements IntegrationEvent<
  typeof THEME_UNAVAILABLE,
  ThemeUnavailablePayload
> {
  readonly eventName = THEME_UNAVAILABLE
  readonly version = THEME_UNAVAILABLE_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: ThemeUnavailablePayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateThemeUnavailableParams): ThemeUnavailable {
    return new ThemeUnavailable(params.eventId, params.occurredAt.getTime(), {
      accountId: params.accountId,
      categorySlug: params.categorySlug,
      difficulty: params.difficulty,
    })
  }
}
