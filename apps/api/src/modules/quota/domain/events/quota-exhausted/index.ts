import type { QuotaPlan } from '@/modules/quota/domain/services/quota-policy/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const QUOTA_EXHAUSTED = 'quota_exhausted'
const QUOTA_EXHAUSTED_VERSION = 1

export interface QuotaExhaustedPayload {
  readonly accountId: string
  readonly plan: QuotaPlan
  readonly renewsAt: string
}

export interface CreateQuotaExhaustedParams {
  readonly eventId: string
  readonly occurredAt: Date
  readonly accountId: string
  readonly plan: QuotaPlan
  readonly renewsAt: Date
}

export class QuotaExhausted implements IntegrationEvent<
  typeof QUOTA_EXHAUSTED,
  QuotaExhaustedPayload
> {
  readonly eventName = QUOTA_EXHAUSTED
  readonly version = QUOTA_EXHAUSTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: QuotaExhaustedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateQuotaExhaustedParams): QuotaExhausted {
    return new QuotaExhausted(params.eventId, params.occurredAt.getTime(), {
      accountId: params.accountId,
      plan: params.plan,
      renewsAt: params.renewsAt.toISOString(),
    })
  }
}
