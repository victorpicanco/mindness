import type { AccountPlan } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const SESSION_DELETED = 'session_deleted'
const SESSION_DELETED_VERSION = 1

export interface SessionDeletedPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly plan: AccountPlan
}

export interface CreateSessionDeletedParams extends SessionDeletedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class SessionDeleted implements IntegrationEvent<
  typeof SESSION_DELETED,
  SessionDeletedPayload
> {
  readonly eventName = SESSION_DELETED
  readonly version = SESSION_DELETED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: SessionDeletedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateSessionDeletedParams): SessionDeleted {
    const payload = Object.freeze({
      sessionId: params.sessionId,
      accountId: params.accountId,
      plan: params.plan,
    })

    return new SessionDeleted(params.eventId, params.occurredAt.getTime(), payload)
  }
}
