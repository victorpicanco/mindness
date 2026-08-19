import { describe, expect, it } from 'vitest'

import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'

import { Session } from './index.js'

describe('Session', () => {
  it('starts an in-progress session with a fifteen-minute expiration', () => {
    const createdAt = new Date('2026-08-18T12:00:00.000Z')
    const configuration = SessionConfiguration.create({
      difficulty: 'balanced',
      categorySlug: 'self-awareness',
      searchWindowMinutes: 4,
    })

    const session = Session.start({
      sessionId: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      configuration,
      quotaReservationId: 'reservation-id',
      createdAt,
    })

    expect(session.id).toBe('session-id')
    expect(session.accountId).toBe('account-id')
    expect(session.themeId).toBe('theme-id')
    expect(session.configuration).toBe(configuration)
    expect(session.quotaReservationId).toBe('reservation-id')
    expect(session.createdAt).toEqual(createdAt)
    expect(session.state).toBe('in_progress')
    expect(session.expiresAt).toEqual(new Date('2026-08-18T12:15:00.000Z'))
  })

  it.each(['timeout', 'abandoned', 'microphone_permission_denied'] as const)(
    'expires an in-progress session because of %s',
    (reason) => {
      const expiredAt = new Date('2026-08-18T12:05:00.000Z')
      const session = createSession()

      session.expire(reason, expiredAt)

      expect(session.state).toBe('expired')
      expect(session.expiredReason).toBe(reason)
      expect(session.expiredAt).toEqual(expiredAt)
    },
  )

  it.each(['processing', 'expired', 'completed', 'failed', 'deleted'] as const)(
    'rejects expiration from the %s state',
    (state) => {
      const session = Session.reconstitute({
        sessionId: 'session-id',
        accountId: 'account-id',
        themeId: 'theme-id',
        configuration: createConfiguration(),
        quotaReservationId: 'reservation-id',
        state,
        createdAt: new Date('2026-08-18T12:00:00.000Z'),
        expiresAt: new Date('2026-08-18T12:15:00.000Z'),
        expiredReason: state === 'expired' ? 'timeout' : null,
        expiredAt: state === 'expired' ? new Date('2026-08-18T12:15:00.000Z') : null,
      })

      expect(() => session.expire('timeout', new Date('2026-08-18T12:20:00.000Z'))).toThrow(
        SessionNotInProgressError,
      )
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
    quotaReservationId: 'reservation-id',
    createdAt: new Date('2026-08-18T12:00:00.000Z'),
  })
}
