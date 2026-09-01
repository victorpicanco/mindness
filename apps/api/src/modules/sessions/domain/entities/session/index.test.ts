import { describe, expect, it } from 'vitest'

import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import { SessionNotDeletableError } from '@/modules/sessions/domain/errors/session-not-deletable-error/index.js'
import { RecordingWindowNotOpenError } from '@/modules/sessions/domain/errors/recording-window-not-open-error/index.js'

import { Session, type SessionState } from './index.js'

const CREATED_AT = new Date('2026-08-18T12:00:00.000Z')
const BEFORE_RESEARCH_ENDS = new Date('2026-08-18T12:03:59.999Z')
const RESEARCH_ENDS_AT = new Date('2026-08-18T12:04:00.000Z')
const WITHIN_WINDOW = new Date('2026-08-18T12:05:59.999Z')
const DEADLINE = new Date('2026-08-18T12:06:00.000Z')
const AFTER_DEADLINE = new Date('2026-08-18T12:06:00.001Z')
const RECORDING_DEADLINE = new Date('2026-08-18T12:15:00.000Z')
const RECORDED_AT = new Date('2026-08-18T12:07:00.000Z')
const COMPLETED_AT = new Date('2026-08-18T12:08:00.000Z')
const STALE_STATES = ['processing', 'expired', 'completed', 'failed', 'deleted'] as const

describe('Session', () => {
  it('starts an in-progress session that expires two minutes after the research window', () => {
    const configuration = createConfiguration()

    const session = Session.start({
      sessionId: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      configuration,
      createdAt: CREATED_AT,
    })

    expect(session.id).toBe('session-id')
    expect(session.accountId).toBe('account-id')
    expect(session.themeId).toBe('theme-id')
    expect(session.configuration).toBe(configuration)
    expect(session.createdAt).toEqual(CREATED_AT)
    expect(session.state).toBe('in_progress')
    expect(session.researchEndsAt).toEqual(RESEARCH_ENDS_AT)
    expect(session.expiresAt).toEqual(DEADLINE)
    expect(session.recordingStartedAt).toBeNull()
  })

  it.each([
    { moment: 'as soon as the research window ends', at: RESEARCH_ENDS_AT },
    { moment: 'at the last instant of the grace', at: WITHIN_WINDOW },
  ])('starts the recording $moment and extends the session deadline', ({ at }) => {
    const session = createSession()

    expect(session.startRecording(at)).toEqual(at)
    expect(session.state).toBe('in_progress')
    expect(session.recordingStartedAt).toEqual(at)
    expect(session.expiresAt).toEqual(RECORDING_DEADLINE)
    expect(session.isLiveAt(AFTER_DEADLINE)).toBe(true)
  })

  it('keeps the first recording instant when the recording is started twice', () => {
    const session = createSession()

    session.startRecording(RESEARCH_ENDS_AT)

    expect(session.startRecording(WITHIN_WINDOW)).toEqual(RESEARCH_ENDS_AT)
    expect(session.recordingStartedAt).toEqual(RESEARCH_ENDS_AT)
    expect(session.expiresAt).toEqual(RECORDING_DEADLINE)
  })

  it('refuses to start the recording before the research window ends', () => {
    const session = createSession()

    expect(() => session.startRecording(BEFORE_RESEARCH_ENDS)).toThrow(RecordingWindowNotOpenError)
    expect(session.recordingStartedAt).toBeNull()
    expect(session.expiresAt).toEqual(DEADLINE)
  })

  it.each([
    { moment: 'exactly at the grace deadline', at: DEADLINE },
    { moment: 'after the grace deadline', at: AFTER_DEADLINE },
  ])('refuses to start the recording $moment', ({ at }) => {
    const session = createSession()

    expect(() => session.startRecording(at)).toThrow(SessionNotInProgressError)
    expect(session.recordingStartedAt).toBeNull()
    expect(session.expiresAt).toEqual(DEADLINE)
  })

  it.each(STALE_STATES)('rejects starting the recording from the %s state', (state) => {
    const session = reconstituteWithState(state)

    expect(() => session.startRecording(RESEARCH_ENDS_AT)).toThrow(SessionNotInProgressError)
  })

  it('preserves the recording instant when reconstituted', () => {
    const session = Session.reconstitute({
      sessionId: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      configuration: createConfiguration(),
      state: 'in_progress',
      createdAt: CREATED_AT,
      expiresAt: RECORDING_DEADLINE,
      expiredReason: null,
      expiredAt: null,
      recordedAt: null,
      recordingStartedAt: RESEARCH_ENDS_AT,
    })

    expect(session.recordingStartedAt).toEqual(RESEARCH_ENDS_AT)
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

  it('completes a processing session without a score', () => {
    const session = reconstituteWithState('processing')

    session.completeWithoutScore(COMPLETED_AT)

    expect(session.state).toBe('completed')
    expect(session.totalScore).toBeNull()
    expect(session.completedAt).toEqual(COMPLETED_AT)
  })

  it('fails a processing session and records why and when it failed', () => {
    const session = reconstituteWithState('processing')

    session.fail('analysis_failed', COMPLETED_AT)

    expect(session.state).toBe('failed')
    expect(session.failureReason).toBe('analysis_failed')
    expect(session.failedAt).toEqual(COMPLETED_AT)
    expect(session.completedAt).toBeNull()
  })

  it.each(['expired', 'completed', 'failed', 'deleted'] as const)(
    'rejects completion and failure from the %s state',
    (state) => {
      const session = reconstituteWithState(state)

      expect(() => session.complete(86, COMPLETED_AT)).toThrow(SessionNotInProgressError)
      expect(() => session.completeWithoutScore(COMPLETED_AT)).toThrow(SessionNotInProgressError)
      expect(() => session.fail('analysis_timeout', COMPLETED_AT)).toThrow(
        SessionNotInProgressError,
      )
    },
  )

  it.each(STALE_STATES)('rejects audio acceptance from the %s state', (state) => {
    const session = reconstituteWithState(state)

    expect(() => session.acceptAudio(createAudio(), WITHIN_WINDOW)).toThrow(
      SessionNotInProgressError,
    )
  })

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

  it.each(['completed', 'failed', 'expired'] as const)(
    'deletes a %s session and records the deletion instant',
    (state) => {
      const session = reconstituteWithState(state)

      session.delete(COMPLETED_AT)

      expect(session.state).toBe('deleted')
      expect(session.deletedAt).toEqual(COMPLETED_AT)
    },
  )

  it.each(['in_progress', 'processing', 'deleted'] as const)(
    'rejects deletion from the %s state with its current state in context',
    (state) => {
      const session = reconstituteWithState(state)

      expect(() => session.delete(COMPLETED_AT)).toThrow(SessionNotDeletableError)
      expect(() => session.delete(COMPLETED_AT)).toThrow(
        expect.objectContaining({ context: { state } }),
      )
    },
  )

  it('preserves the deletion instant when reconstituted', () => {
    const session = Session.reconstitute({
      sessionId: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      configuration: createConfiguration(),
      state: 'deleted',
      createdAt: CREATED_AT,
      expiresAt: DEADLINE,
      expiredReason: null,
      expiredAt: null,
      recordedAt: null,
      deletedAt: COMPLETED_AT,
    })

    expect(session.deletedAt).toEqual(COMPLETED_AT)
  })

  it('has no deletion instant before deletion', () => {
    expect(createSession().deletedAt).toBeNull()
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
    createdAt: CREATED_AT,
  })
}

function reconstituteWithState(state: SessionState): Session {
  return Session.reconstitute({
    sessionId: 'session-id',
    accountId: 'account-id',
    themeId: 'theme-id',
    configuration: createConfiguration(),
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
