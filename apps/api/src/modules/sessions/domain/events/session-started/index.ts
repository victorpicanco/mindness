import type { SessionDifficulty } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const SESSION_STARTED = 'session_started'
const SESSION_STARTED_VERSION = 1

export interface SessionStartedPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly difficulty: SessionDifficulty
  readonly categorySlug: string
  readonly searchWindowMinutes: number
  readonly surface: 'web'
}

export interface CreateSessionStartedParams extends Omit<SessionStartedPayload, 'surface'> {
  readonly eventId: string
  readonly occurredAt: Date
}

export class SessionStarted implements IntegrationEvent<
  typeof SESSION_STARTED,
  SessionStartedPayload
> {
  readonly eventName = SESSION_STARTED
  readonly version = SESSION_STARTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: SessionStartedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateSessionStartedParams): SessionStarted {
    return new SessionStarted(params.eventId, params.occurredAt.getTime(), {
      sessionId: params.sessionId,
      accountId: params.accountId,
      difficulty: params.difficulty,
      categorySlug: params.categorySlug,
      searchWindowMinutes: params.searchWindowMinutes,
      surface: 'web',
    })
  }
}
