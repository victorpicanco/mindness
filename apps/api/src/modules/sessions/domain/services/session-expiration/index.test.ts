import { describe, expect, it } from 'vitest'

import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { MicrophonePermissionDenied } from '@/modules/sessions/domain/events/microphone-permission-denied/index.js'
import { SessionExpired } from '@/modules/sessions/domain/events/session-expired/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import { SessionExpiration } from './index.js'

const CREATED_AT = new Date('2026-08-18T12:00:00.000Z')
const EXPIRED_AT = new Date('2026-08-18T12:20:00.000Z')

describe('SessionExpiration', () => {
  it.each(['timeout', 'abandoned'] as const)(
    'expires the session and emits only the expiration event for %s',
    (reason) => {
      const session = createSession()

      const outcome = SessionExpiration.expire({
        session,
        reason,
        at: EXPIRED_AT,
        eventIds: ['event-1', 'event-2'],
      })

      expect(outcome.expired).toBe(true)
      expect(session.state).toBe('expired')
      expect(session.expiredReason).toBe(reason)
      expect(outcome.events).toHaveLength(1)
      expect(outcome.events[0]).toBeInstanceOf(SessionExpired)
      expect(outcome.events[0]?.payload).toEqual({
        sessionId: 'session-id',
        accountId: 'account-id',
        stoppedAtStage: 'in_progress',
      })
    },
  )

  it('also emits the microphone event when permission was denied', () => {
    const session = createSession()

    const outcome = SessionExpiration.expire({
      session,
      reason: 'microphone_permission_denied',
      at: EXPIRED_AT,
      eventIds: ['event-1', 'event-2'],
    })

    expect(outcome.expired).toBe(true)
    expect(outcome.events).toHaveLength(2)
    expect(outcome.events[0]).toBeInstanceOf(SessionExpired)
    expect(outcome.events[1]).toBeInstanceOf(MicrophonePermissionDenied)
    expect(outcome.events[1]?.payload).toEqual({
      sessionId: 'session-id',
      accountId: 'account-id',
    })
  })

  it('reads the stage from the session before the transition, not from a fixed literal', () => {
    const session = createSession()

    const outcome = SessionExpiration.expire({
      session,
      reason: 'timeout',
      at: EXPIRED_AT,
      eventIds: ['event-1', 'event-2'],
    })

    const [event] = outcome.events
    expect(event).toBeInstanceOf(SessionExpired)
    if (!(event instanceof SessionExpired)) return

    expect(event.payload.stoppedAtStage).toBe('in_progress')
    expect(session.state).toBe('expired')
  })

  it.each(['processing', 'expired', 'completed', 'failed', 'deleted'] as const)(
    'is a no-op without events from the %s state',
    (state) => {
      const session = Session.reconstitute({
        sessionId: 'session-id',
        accountId: 'account-id',
        themeId: 'theme-id',
        configuration: createConfiguration(),
        state,
        createdAt: CREATED_AT,
        expiresAt: new Date('2026-08-18T12:15:00.000Z'),
        expiredReason: state === 'expired' ? 'timeout' : null,
        expiredAt: state === 'expired' ? CREATED_AT : null,
        recordedAt: null,
      })

      const outcome = SessionExpiration.expire({
        session,
        reason: 'timeout',
        at: EXPIRED_AT,
        eventIds: ['event-1', 'event-2'],
      })

      expect(outcome.expired).toBe(false)
      expect(outcome.events).toEqual([])
      expect(session.state).toBe(state)
    },
  )
})

function createConfiguration(): SessionConfiguration {
  return SessionConfiguration.create({
    difficulty: 'balanced',
    categorySlug: 'self-awareness',
    searchWindowMinutes: 4,
  })
}

function createSession(): Session {
  return Session.start({
    sessionId: 'session-id',
    accountId: 'account-id',
    themeId: 'theme-id',
    configuration: createConfiguration(),
    createdAt: CREATED_AT,
  })
}
