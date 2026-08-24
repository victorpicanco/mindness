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

    store.getState().startResearching()
    expect(store.getState().status).toBe('researching')

    store.getState().beginRecording()
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

  it('discards unsent audio when the local retention window expires', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-23T12:00:00.000Z'))
    const store = createPracticeSessionStore()
    const audioBlob = new Blob(['audio'], { type: 'audio/webm' })

    store.getState().startResearching()
    store.getState().beginRecording()
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
})
