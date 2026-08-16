import type { AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'
import type { AuthenticationRejectionReason } from '@/modules/accounts/domain/errors/authentication-rejected-error/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const GOOGLE_LOGIN_REJECTED = 'google_login_rejected'
const GOOGLE_LOGIN_REJECTED_VERSION = 1

export interface GoogleLoginRejectedPayload {
  readonly accountId: string | null
  readonly plan: AccountPlan | null
  readonly reason: AuthenticationRejectionReason
}

export interface CreateGoogleLoginRejectedParams extends GoogleLoginRejectedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class GoogleLoginRejected implements IntegrationEvent<
  typeof GOOGLE_LOGIN_REJECTED,
  GoogleLoginRejectedPayload
> {
  readonly eventName = GOOGLE_LOGIN_REJECTED
  readonly version = GOOGLE_LOGIN_REJECTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: GoogleLoginRejectedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateGoogleLoginRejectedParams): GoogleLoginRejected {
    return new GoogleLoginRejected(params.eventId, params.occurredAt.getTime(), {
      accountId: params.accountId,
      plan: params.plan,
      reason: params.reason,
    })
  }
}
