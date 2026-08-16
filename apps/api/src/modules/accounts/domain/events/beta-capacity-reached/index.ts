import type { AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const BETA_CAPACITY_REACHED = 'beta_capacity_reached'
const BETA_CAPACITY_REACHED_VERSION = 1

export interface BetaCapacityReachedPayload {
  readonly accountId: null
  readonly plan: AccountPlan
  readonly capacity: number
}

export interface CreateBetaCapacityReachedParams {
  readonly eventId: string
  readonly occurredAt: Date
  readonly plan: AccountPlan
  readonly capacity: number
}

export class BetaCapacityReached implements IntegrationEvent<
  typeof BETA_CAPACITY_REACHED,
  BetaCapacityReachedPayload
> {
  readonly eventName = BETA_CAPACITY_REACHED
  readonly version = BETA_CAPACITY_REACHED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: BetaCapacityReachedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateBetaCapacityReachedParams): BetaCapacityReached {
    return new BetaCapacityReached(params.eventId, params.occurredAt.getTime(), {
      accountId: null,
      plan: params.plan,
      capacity: params.capacity,
    })
  }
}
