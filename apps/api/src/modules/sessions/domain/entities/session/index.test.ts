import { describe, expect, it } from 'vitest'

import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'

import { Session } from './index.js'

const CREATED_AT = new Date('2026-08-18T12:00:00.000Z')
const WITHIN_WINDOW = new Date('2026-08-18T12:14:59.999Z')
const DEADLINE = new Date('2026-08-18T12:15:00.000Z')
const AFTER_DEADLINE = new Date('2026-08-18T12:15:00.001Z')
const RECORDED_AT = new Date('2026-08-18T12:07:00.000Z')
const COMPLETED_AT = new Date('2026-08-18T12:08:00.000Z')
const STALE_STATES = ['processing', 'expired', 'completed', 'failed', 'deleted'] as const

describe('Session', () => {
  it('starts an in-progress session with a fifteen-minute expiration', () => {
    const configuration = createConfiguration()

    const session = Session.start({
      sessionId: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      configuration,
      quotaReservationId: 'reservation-id',
      createdAt: CREATED_AT,
    })

    expect(session.id).toBe('session-id')
    expect(session.accountId).toBe('account-id')
    expect(session.themeId).toBe('theme-id')
    expect(session.configuration).toBe(configuration)
    expect(session.quotaReservationId).toBe('reservation-id')
    expect(session.createdAt).toEqual(CREATED_AT)
    expect(session.state).toBe('in_progress')
    expect(session.expiresAt).toEqual(DEADLINE)
  })

  it.each(['timeout', 'abandoned', 'microphone_permission_denied'] as const)(
    'expires an in-progress session because of %s',
    (reason) => {
      const session = createSession()

      session.expire(reason, WITHIN_WINDOW)

      expect(session.state).toBe('expired')
      expect(session.expiredReason).toBe(reason)
      expect(session.expiredAt).toEqual(WITHIN_WINDOW)
    },
  )

  it.each(STALE_STATES)('rejects expiration from the %s state', (state) => {
    const session = reconstituteWithState(state)

    expect(() => session.expire('timeout', AFTER_DEADLINE)).toThrow(SessionNotInProgressError)
  })

  it('accepts audio while the session is still inside its window', () => {
    const session = createSession()
    const audio = createAudio()

    session.acceptAudio(audio, WITHIN_WINDOW)

    expect(session.state).toBe('processing')
    expect(session.audio).toBe(audio)
    expect(session.recordedAt).toEqual(WITHIN_WINDOW)
  })

  it('preserves the accepted recording instant when reconstituted', () => {
    const session = Session.reconstitute({
      sessionId: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      configuration: createConfiguration(),
      quotaReservationId: 'reservation-id',
      state: 'processing',
      createdAt: CREATED_AT,
      expiresAt: DEADLINE,
      expiredReason: null,
      expiredAt: null,
      audio: createAudio(),
      recordedAt: RECORDED_AT,
    })

    expect(session.recordedAt).toEqual(RECORDED_AT)
  })

  it('has no recorded instant before accepting audio', () => {
    expect(createSession().recordedAt).toBeNull()
  })

  it('completes a processing session with its score and completion instant', () => {
    const session = reconstituteWithState('processing')

    session.complete(86, COMPLETED_AT)

    expect(session.state).toBe('completed')
    expect(session.totalScore).toBe(86)
    expect(session.completedAt).toEqual(COMPLETED_AT)
  })

  it('fails a processing session and records when it failed', () => {
    const session = reconstituteWithState('processing')

    session.fail(COMPLETED_AT)

    expect(session.state).toBe('failed')
    expect(session.failedAt).toEqual(COMPLETED_AT)
    expect(session.completedAt).toBeNull()
  })

  it.each(['expired', 'completed', 'failed', 'deleted'] as const)(
    'rejects completion and failure from the %s state',
    (state) => {
      const session = reconstituteWithState(state)

      expect(() => session.complete(86, COMPLETED_AT)).toThrow(SessionNotInProgressError)
      expect(() => session.fail(COMPLETED_AT)).toThrow(SessionNotInProgressError)
    },
  )

  it.each(STALE_STATES)('rejects audio acceptance from the %s state', (state) => {
    const session = reconstituteWithState(state)

    expect(() => session.acceptAudio(createAudio(), WITHIN_WINDOW)).toThrow(
      SessionNotInProgressError,
    )
  })

  // DA-11: the fifteen-minute deadline is an invariant of the aggregate, not of whichever
  // caller happens to notice the session is stale first.
  it.each([
    { moment: 'exactly at the deadline', at: DEADLINE },
    { moment: 'after the deadline', at: AFTER_DEADLINE },
  ])('refuses audio $moment even while the row still reads in_progress', ({ at }) => {
    const session = createSession()

    expect(() => session.acceptAudio(createAudio(), at)).toThrow(SessionNotInProgressError)
    expect(session.state).toBe('in_progress')
    expect(session.audio).toBeNull()
  })

  it('reports whether it is live at a given instant', () => {
    const session = createSession()

    expect(session.isLiveAt(WITHIN_WINDOW)).toBe(true)
    expect(session.hasElapsedAt(WITHIN_WINDOW)).toBe(false)
    expect(session.isLiveAt(DEADLINE)).toBe(false)
    expect(session.hasElapsedAt(DEADLINE)).toBe(true)
    expect(session.isLiveAt(AFTER_DEADLINE)).toBe(false)
    expect(session.hasElapsedAt(AFTER_DEADLINE)).toBe(true)
  })

  it.each(STALE_STATES)('is neither live nor elapsed from the %s state', (state) => {
    const session = reconstituteWithState(state)

    expect(session.isLiveAt(WITHIN_WINDOW)).toBe(false)
    expect(session.hasElapsedAt(AFTER_DEADLINE)).toBe(false)
  })
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
    createdAt: CREATED_AT,
  })
}

function reconstituteWithState(state: (typeof STALE_STATES)[number]): Session {
  return Session.reconstitute({
    sessionId: 'session-id',
    accountId: 'account-id',
    themeId: 'theme-id',
    configuration: createConfiguration(),
    quotaReservationId: 'reservation-id',
    state,
    createdAt: CREATED_AT,
    expiresAt: DEADLINE,
    expiredReason: state === 'expired' ? 'timeout' : null,
    expiredAt: state === 'expired' ? DEADLINE : null,
    recordedAt: null,
  })
}

function createAudio(): SessionAudio {
  return SessionAudio.create({
    id: '00000000-0000-4000-8000-0000000000a1',
    durationSeconds: 42,
    sizeBytes: 1024,
    contentType: 'audio/webm',
    storagePath: 'account-id/session-id/audio',
  })
}
