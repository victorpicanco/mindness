import type { AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ACCOUNT_DELETION_REQUESTED = 'account_deletion_requested'
const ACCOUNT_DELETION_REQUESTED_VERSION = 1

export interface AccountDeletionRequestedPayload {
  readonly accountId: string
  readonly plan: AccountPlan
  readonly scheduledFor: string
}

export interface CreateAccountDeletionRequestedParams extends AccountDeletionRequestedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class AccountDeletionRequested implements IntegrationEvent<
  typeof ACCOUNT_DELETION_REQUESTED,
  AccountDeletionRequestedPayload
> {
  readonly eventName = ACCOUNT_DELETION_REQUESTED
  readonly version = ACCOUNT_DELETION_REQUESTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: AccountDeletionRequestedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateAccountDeletionRequestedParams): AccountDeletionRequested {
    return new AccountDeletionRequested(params.eventId, params.occurredAt.getTime(), {
      accountId: params.accountId,
      plan: params.plan,
      scheduledFor: params.scheduledFor,
    })
  }
}
