import type { ThemeDifficulty } from '@/modules/themes/domain/entities/theme/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const THEME_REJECTED = 'theme_rejected'
const THEME_REJECTED_VERSION = 1

export interface ThemeRejectedIssue {
  readonly field: string
  readonly reason: string
}

export interface ThemeRejectedPayload {
  readonly title: string
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
  readonly issues: readonly ThemeRejectedIssue[]
}

export interface CreateThemeRejectedParams {
  readonly eventId: string
  readonly occurredAt: Date
  readonly title: string
  readonly categorySlug: string
  readonly difficulty: ThemeDifficulty
  readonly issues: readonly ThemeRejectedIssue[]
}

export class ThemeRejected implements IntegrationEvent<
  typeof THEME_REJECTED,
  ThemeRejectedPayload
> {
  readonly eventName = THEME_REJECTED
  readonly version = THEME_REJECTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: ThemeRejectedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateThemeRejectedParams): ThemeRejected {
    return new ThemeRejected(params.eventId, params.occurredAt.getTime(), {
      title: params.title,
      categorySlug: params.categorySlug,
      difficulty: params.difficulty,
      issues: params.issues.map((issue) => ({ field: issue.field, reason: issue.reason })),
    })
  }
}
