import type { SessionState } from '@/modules/sessions/domain/entities/session/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const SESSION_EXPIRED = 'session_expired'
const SESSION_EXPIRED_VERSION = 1

export interface SessionExpiredPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly stoppedAtStage: SessionState
}

export interface CreateSessionExpiredParams extends SessionExpiredPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class SessionExpired implements IntegrationEvent<
  typeof SESSION_EXPIRED,
  SessionExpiredPayload
> {
  readonly eventName = SESSION_EXPIRED
  readonly version = SESSION_EXPIRED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: SessionExpiredPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateSessionExpiredParams): SessionExpired {
    return new SessionExpired(params.eventId, params.occurredAt.getTime(), {
      sessionId: params.sessionId,
      accountId: params.accountId,
      stoppedAtStage: params.stoppedAtStage,
    })
  }
}
