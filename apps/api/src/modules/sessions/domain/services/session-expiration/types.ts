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
  // Two ids are always supplied because a microphone denial emits a second event; the
  // domain never reaches for an id generator itself.
  readonly eventIds: readonly [string, string]
}

export interface SessionExpirationOutcome {
  readonly expired: boolean
  readonly events: readonly SessionExpirationEvent[]
}
