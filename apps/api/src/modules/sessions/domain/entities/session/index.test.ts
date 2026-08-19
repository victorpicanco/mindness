import { describe, expect, it } from 'vitest'

import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

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
})
