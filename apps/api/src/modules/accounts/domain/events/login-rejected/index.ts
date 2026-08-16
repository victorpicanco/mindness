import type { AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'
import type { AuthenticationRejectionReason } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const LOGIN_REJECTED = 'login_rejected'
const LOGIN_REJECTED_VERSION = 1

export interface LoginRejectedPayload {
  readonly accountId: string | null
  readonly plan: AccountPlan | null
  readonly reason: AuthenticationRejectionReason
}

export interface CreateLoginRejectedParams extends LoginRejectedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class LoginRejected implements IntegrationEvent<
  typeof LOGIN_REJECTED,
  LoginRejectedPayload
> {
  readonly eventName = LOGIN_REJECTED
  readonly version = LOGIN_REJECTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: LoginRejectedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateLoginRejectedParams): LoginRejected {
    return new LoginRejected(params.eventId, params.occurredAt.getTime(), {
      accountId: params.accountId,
      plan: params.plan,
      reason: params.reason,
    })
  }
}
