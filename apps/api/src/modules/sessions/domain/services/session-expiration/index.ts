import { MicrophonePermissionDenied } from '@/modules/sessions/domain/events/microphone-permission-denied/index.js'
import { SessionExpired } from '@/modules/sessions/domain/events/session-expired/index.js'

import type { ExpireSessionParams, SessionExpirationOutcome } from './types.js'

const NOT_EXPIRED: SessionExpirationOutcome = { expired: false, events: [] }

export class SessionExpiration {
  static expire(params: ExpireSessionParams): SessionExpirationOutcome {
    const { session, reason, at, eventIds } = params

    if (session.state !== 'in_progress') return NOT_EXPIRED

    const stoppedAtStage = session.state
    session.expire(reason, at)

    const expired = SessionExpired.create({
      eventId: eventIds[0],
      occurredAt: at,
      sessionId: session.id,
      accountId: session.accountId,
      stoppedAtStage,
    })

    if (reason !== 'microphone_permission_denied') return { expired: true, events: [expired] }

    return {
      expired: true,
      events: [
        expired,
        MicrophonePermissionDenied.create({
          eventId: eventIds[1],
          occurredAt: at,
          sessionId: session.id,
          accountId: session.accountId,
        }),
      ],
    }
  }
}

export type { ExpireSessionParams, SessionExpirationOutcome } from './types.js'
