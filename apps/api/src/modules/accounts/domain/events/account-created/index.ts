import type { AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ACCOUNT_CREATED = 'account_created'
const ACCOUNT_CREATED_VERSION = 1

export interface AccountCreatedPayload {
  readonly accountId: string
  readonly plan: AccountPlan
}

export interface CreateAccountCreatedParams {
  readonly eventId: string
  readonly occurredAt: Date
  readonly accountId: string
  readonly plan: AccountPlan
}

export class AccountCreated implements IntegrationEvent<
  typeof ACCOUNT_CREATED,
  AccountCreatedPayload
> {
  readonly eventName = ACCOUNT_CREATED
  readonly version = ACCOUNT_CREATED_VERSION

  private constructor(
    readonly eventId: string,
    readonly occurredAt: Date,
    readonly payload: AccountCreatedPayload,
  ) {}

  static create(params: CreateAccountCreatedParams): AccountCreated {
    return new AccountCreated(params.eventId, params.occurredAt, {
      accountId: params.accountId,
      plan: params.plan,
    })
  }
}
