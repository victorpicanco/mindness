import type {
  Session,
  SessionExpiredReason,
} from '@/modules/sessions/domain/entities/session/index.js'
import type { MicrophonePermissionDenied } from '@/modules/sessions/domain/events/microphone-permission-denied/index.js'
import type { SessionExpired } from '@/modules/sessions/domain/events/session-expired/index.js'

export type SessionExpirationEvent = SessionExpired | MicrophonePermissionDenied

export interface ExpireSessionParams {
  readonly session: Session
  readonly reason: SessionExpiredReason
  readonly at: Date
  readonly eventIds: readonly [string, string]
}

export interface SessionExpirationOutcome {
  readonly expired: boolean
  readonly events: readonly SessionExpirationEvent[]
}
