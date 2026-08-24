import { describe, expect, it } from 'vitest'

import { InvalidPracticeSessionTransitionError } from './errors'
import { createPracticeSessionStore } from './store'

describe('practice session store', () => {
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
      retentionDeadline: null,
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
})
