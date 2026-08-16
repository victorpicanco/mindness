import type { AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ACCOUNT_CREATION_REJECTED = 'account_creation_rejected'
const ACCOUNT_CREATION_REJECTED_VERSION = 1

export interface AccountCreationRejectedPayload {
  readonly accountId: string
  readonly plan: AccountPlan
  readonly reason: 'duplicate'
}

export interface CreateAccountCreationRejectedParams {
  readonly eventId: string
  readonly occurredAt: Date
  readonly accountId: string
  readonly plan: AccountPlan
}

export class AccountCreationRejected implements IntegrationEvent<
  typeof ACCOUNT_CREATION_REJECTED,
  AccountCreationRejectedPayload
> {
  readonly eventName = ACCOUNT_CREATION_REJECTED
  readonly version = ACCOUNT_CREATION_REJECTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: AccountCreationRejectedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateAccountCreationRejectedParams): AccountCreationRejected {
    return new AccountCreationRejected(params.eventId, params.occurredAt.getTime(), {
      accountId: params.accountId,
      plan: params.plan,
      reason: 'duplicate',
    })
  }
}
