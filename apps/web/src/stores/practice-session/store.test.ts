import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidPracticeSessionTransitionError } from './errors'
import { createPracticeSessionStore } from './store'

const SESSION_CONFIGURATION = {
  categorySlug: 'news',
  difficulty: 'balanced',
  searchWindowMinutes: 3,
} as const

describe('practice session store', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves through the valid practice session transitions', () => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const session = {
      configuration: SESSION_CONFIGURATION,
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    store.getState().startResearching(session, '2026-08-24T12:00:00.000Z')
    expect(store.getState()).toMatchObject({ status: 'researching', session })

    store.getState().openRecordingWindow()
    expect(store.getState().status).toBe('awaiting-recording')

    store.getState().openRecording({
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: '2026-08-24T12:05:00.000Z',
    })
    expect(store.getState().status).toBe('recording')

    store.getState().captureAudio(audioBlob)
    expect(store.getState()).toMatchObject({
      status: 'uploading',
      audioBlob,
    })

    store.getState().discardAudio()
    expect(store.getState()).toMatchObject({
      status: 'recording',
      audioBlob: null,
      retentionDeadline: null,
    })

    store.getState().reset()
    expect(store.getState()).toMatchObject({
      status: 'idle',
      audioBlob: null,
      retentionDeadline: null,
    })
  })

  it('stores the server clock offset once when research starts', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-24T11:55:00.000Z'))
    const store = createPracticeSessionStore()

    store.getState().startResearching(
      {
        configuration: SESSION_CONFIGURATION,
        createdAt: '2026-08-24T12:00:00.000Z',
        expiresAt: '2026-08-24T12:07:00.000Z',
        recordingStartedAt: null,
        researchEndsAt: '2026-08-24T12:05:00.000Z',
        sessionId: 'session-1',
        themeTitle: 'Communicating with clarity',
      },
      '2026-08-24T12:00:00.000Z',
    )

    expect(store.getState().serverTimeOffsetMs).toBe(5 * 60 * 1_000)

    vi.advanceTimersByTime(30_000)
    expect(store.getState().serverTimeOffsetMs).toBe(5 * 60 * 1_000)
  })

  it('rejects an action outside its allowed source status', () => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

    expect(() => store.getState().captureAudio(audioBlob)).toThrow(
      InvalidPracticeSessionTransitionError,
    )
  })

  it('refuses to begin the recording before the recording window opens', () => {
    const store = createPracticeSessionStore()

    store.getState().startResearching(
      {
        configuration: SESSION_CONFIGURATION,
        createdAt: '2026-08-24T12:00:00.000Z',
        expiresAt: '2026-08-24T12:07:00.000Z',
        recordingStartedAt: null,
        researchEndsAt: '2026-08-24T12:05:00.000Z',
        sessionId: 'session-1',
        themeTitle: 'Communicating with clarity',
      },
      '2026-08-24T12:00:00.000Z',
    )

    expect(() =>
      store.getState().openRecording({
        expiresAt: '2026-08-24T12:15:00.000Z',
        recordingStartedAt: '2026-08-24T12:05:00.000Z',
      }),
    ).toThrow(InvalidPracticeSessionTransitionError)
  })

  it('expires the session when the recording window closes unused', () => {
    const store = createPracticeSessionStore()
    const session = {
      configuration: SESSION_CONFIGURATION,
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    store.getState().startResearching(session, '2026-08-24T12:00:00.000Z')
    store.getState().openRecordingWindow()
    store.getState().expireSession()

    expect(store.getState()).toMatchObject({ status: 'expired', session })
    expect(() => store.getState().expireSession()).toThrow(InvalidPracticeSessionTransitionError)
  })

  it.each(['recording', 'uploading'] as const)('expires the session from %s', (status) => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

    store.getState().startResearching(
      {
        configuration: SESSION_CONFIGURATION,
        createdAt: '2026-08-24T12:00:00.000Z',
        expiresAt: '2026-08-24T12:15:00.000Z',
        recordingStartedAt: null,
        researchEndsAt: '2026-08-24T12:05:00.000Z',
        sessionId: 'session-1',
        themeTitle: 'Communicating with clarity',
      },
      '2026-08-24T12:00:00.000Z',
    )
    store.getState().openRecordingWindow()
    store.getState().openRecording({
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: '2026-08-24T12:05:00.000Z',
    })

    if (status === 'uploading') store.getState().captureAudio(audioBlob)

    store.getState().expireSession()

    expect(store.getState().status).toBe('expired')
  })

  it('starts hydrated with an active session', () => {
    const session = {
      configuration: SESSION_CONFIGURATION,
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:05:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:03:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    const store = createPracticeSessionStore({
      serverTimeOffsetMs: 0,
      status: 'researching',
      session,
    })

    expect(store.getState()).toMatchObject({ status: 'researching', session })
  })

  it('opens recording with the server recording timestamp and deadline', () => {
    const store = createPracticeSessionStore()
    const session = {
      configuration: SESSION_CONFIGURATION,
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:06:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:04:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    store.getState().startResearching(session, '2026-08-24T12:00:00.000Z')
    store.getState().openRecordingWindow()
    store.getState().openRecording({
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: '2026-08-24T12:04:00.000Z',
    })

    expect(store.getState()).toMatchObject({
      session: {
        ...session,
        expiresAt: '2026-08-24T12:15:00.000Z',
        recordingStartedAt: '2026-08-24T12:04:00.000Z',
      },
      status: 'recording',
    })
  })

  it('moves from uploading to processing only', () => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const session = {
      configuration: SESSION_CONFIGURATION,
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    expect(() => store.getState().beginProcessing()).toThrow(InvalidPracticeSessionTransitionError)

    store.getState().startResearching(session, '2026-08-24T12:00:00.000Z')
    store.getState().openRecordingWindow()
    store.getState().openRecording({
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: '2026-08-24T12:05:00.000Z',
    })
    store.getState().captureAudio(audioBlob)
    store.getState().beginProcessing()

    expect(store.getState().status).toBe('processing')
  })

  it('keeps the finished conversation when the analysis arrives', () => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const session = {
      configuration: SESSION_CONFIGURATION,
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    } as const

    expect(() => store.getState().completeAnalysis()).toThrow(InvalidPracticeSessionTransitionError)

    store.getState().startResearching(session, '2026-08-24T12:00:00.000Z')
    store.getState().openRecordingWindow()
    store.getState().openRecording({
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: '2026-08-24T12:05:00.000Z',
    })
    store.getState().captureAudio(audioBlob)
    store.getState().beginProcessing()
    store.getState().completeAnalysis()

    expect(store.getState()).toMatchObject({
      audioBlob,
      session: {
        ...session,
        expiresAt: '2026-08-24T12:15:00.000Z',
        recordingStartedAt: '2026-08-24T12:05:00.000Z',
      },
      status: 'done',
    })
  })

  it('starts a new session over a finished one', () => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const session = {
      configuration: SESSION_CONFIGURATION,
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    } as const
    const nextSession = { ...session, sessionId: 'session-2', themeTitle: 'Speaking with rhythm' }

    store.getState().startResearching(session, '2026-08-24T12:00:00.000Z')
    store.getState().openRecordingWindow()
    store.getState().openRecording({
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: '2026-08-24T12:05:00.000Z',
    })
    store.getState().captureAudio(audioBlob)
    store.getState().beginProcessing()
    store.getState().completeAnalysis()

    store.getState().startResearching(nextSession, '2026-08-24T12:20:00.000Z')

    expect(store.getState()).toMatchObject({
      audioBlob: null,
      session: nextSession,
      status: 'researching',
    })
  })

  it('discards unsent audio when the local retention window expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'))
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

    store.getState().startResearching(
      {
        configuration: SESSION_CONFIGURATION,
        createdAt: '2026-08-23T12:00:00.000Z',
        expiresAt: '2026-08-23T12:07:00.000Z',
        recordingStartedAt: null,
        researchEndsAt: '2026-08-23T12:05:00.000Z',
        sessionId: 'session-1',
        themeTitle: 'Communicating with clarity',
      },
      '2026-08-23T12:00:00.000Z',
    )
    store.getState().openRecordingWindow()
    store.getState().openRecording({
      expiresAt: '2026-08-23T12:15:00.000Z',
      recordingStartedAt: '2026-08-23T12:05:00.000Z',
    })
    store.getState().captureAudio(audioBlob)

    expect(store.getState().retentionDeadline).toBe(Date.now() + 15 * 60 * 1_000)

    vi.advanceTimersByTime(15 * 60 * 1_000 - 1)
    expect(store.getState().audioBlob).toBe(audioBlob)

    vi.advanceTimersByTime(1)
    expect(store.getState()).toMatchObject({
      status: 'expired',
      audioBlob: null,
      retentionDeadline: null,
    })
  })

  it('never retains captured audio past the session deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'))
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

    store.getState().startResearching(
      {
        configuration: SESSION_CONFIGURATION,
        createdAt: '2026-08-23T12:00:00.000Z',
        expiresAt: '2026-08-23T12:01:00.000Z',
        recordingStartedAt: null,
        researchEndsAt: '2026-08-23T12:00:00.000Z',
        sessionId: 'session-1',
        themeTitle: 'Communicating with clarity',
      },
      '2026-08-23T12:00:00.000Z',
    )
    store.getState().openRecordingWindow()
    store.getState().openRecording({
      expiresAt: '2026-08-23T12:01:00.000Z',
      recordingStartedAt: '2026-08-23T12:00:00.000Z',
    })
    store.getState().captureAudio(audioBlob)

    expect(store.getState().retentionDeadline).toBe(Date.now() + 60 * 1_000)

    vi.advanceTimersByTime(60 * 1_000)
    expect(store.getState()).toMatchObject({
      status: 'expired',
      audioBlob: null,
      retentionDeadline: null,
    })
  })
})
