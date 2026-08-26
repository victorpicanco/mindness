import { afterEach, describe, expect, it, vi } from 'vitest'

import { InvalidPracticeSessionTransitionError } from './errors'
import { createPracticeSessionStore } from './store'

describe('practice session store', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('moves through the valid practice session transitions', () => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })
    const session = {
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    store.getState().startResearching(session)
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

  it('rejects an action outside its allowed source status', () => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

    expect(() => store.getState().captureAudio(audioBlob)).toThrow(
      InvalidPracticeSessionTransitionError,
    )
  })

  it('refuses to begin the recording before the recording window opens', () => {
    const store = createPracticeSessionStore()

    store.getState().startResearching({
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    })

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
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    store.getState().startResearching(session)
    store.getState().openRecordingWindow()
    store.getState().expireSession()

    expect(store.getState()).toMatchObject({ status: 'expired', session })
    expect(() => store.getState().expireSession()).toThrow(InvalidPracticeSessionTransitionError)
  })

  it.each(['recording', 'uploading'] as const)('expires the session from %s', (status) => {
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

    store.getState().startResearching({
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    })
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
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:05:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:03:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    const store = createPracticeSessionStore({ status: 'researching', session })

    expect(store.getState()).toMatchObject({ status: 'researching', session })
  })

  it('opens recording with the server recording timestamp and deadline', () => {
    const store = createPracticeSessionStore()
    const session = {
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:06:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:04:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    store.getState().startResearching(session)
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
      createdAt: '2026-08-24T12:00:00.000Z',
      expiresAt: '2026-08-24T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-24T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    }

    expect(() => store.getState().beginProcessing()).toThrow(InvalidPracticeSessionTransitionError)

    store.getState().startResearching(session)
    store.getState().openRecordingWindow()
    store.getState().openRecording({
      expiresAt: '2026-08-24T12:15:00.000Z',
      recordingStartedAt: '2026-08-24T12:05:00.000Z',
    })
    store.getState().captureAudio(audioBlob)
    store.getState().beginProcessing()

    expect(store.getState().status).toBe('processing')
  })

  it('discards unsent audio when the local retention window expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'))
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

    store.getState().startResearching({
      createdAt: '2026-08-23T12:00:00.000Z',
      expiresAt: '2026-08-23T12:07:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-23T12:05:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    })
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

    store.getState().startResearching({
      createdAt: '2026-08-23T12:00:00.000Z',
      expiresAt: '2026-08-23T12:01:00.000Z',
      recordingStartedAt: null,
      researchEndsAt: '2026-08-23T12:00:00.000Z',
      sessionId: 'session-1',
      themeTitle: 'Communicating with clarity',
    })
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
