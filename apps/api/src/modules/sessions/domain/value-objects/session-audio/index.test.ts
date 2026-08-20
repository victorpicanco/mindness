import { describe, expect, it } from 'vitest'

import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

import { MAX_AUDIO_DURATION_SECONDS, MAX_AUDIO_SIZE_BYTES, SessionAudio } from './index.js'

const AUDIO_ID = '00000000-0000-4000-8000-0000000000a1'

describe('SessionAudio', () => {
  it('creates an audio value object within the accepted limits', () => {
    const audio = SessionAudio.create({
      id: AUDIO_ID,
      durationSeconds: MAX_AUDIO_DURATION_SECONDS,
      sizeBytes: MAX_AUDIO_SIZE_BYTES,
      contentType: 'audio/webm',
      storagePath: 'account-id/session-id/audio',
    })

    expect(audio.id).toBe(AUDIO_ID)
    expect(audio.durationSeconds).toBe(MAX_AUDIO_DURATION_SECONDS)
    expect(audio.sizeBytes).toBe(MAX_AUDIO_SIZE_BYTES)
    expect(audio.contentType).toBe('audio/webm')
    expect(audio.storagePath).toBe('account-id/session-id/audio')
  })

  it('publishes the limits RF-003 and DA-04 impose so no other layer restates them', () => {
    expect(MAX_AUDIO_DURATION_SECONDS).toBe(60)
    expect(MAX_AUDIO_SIZE_BYTES).toBe(25 * 1024 * 1024)
  })

  it.each([
    { case: 'zero duration', durationSeconds: 0, sizeBytes: 1 },
    { case: 'duration beyond the cap', durationSeconds: 60.1, sizeBytes: 1 },
    { case: 'size beyond the cap', durationSeconds: 1, sizeBytes: MAX_AUDIO_SIZE_BYTES + 1 },
    { case: 'empty object', durationSeconds: 1, sizeBytes: 0 },
    { case: 'negative size', durationSeconds: 1, sizeBytes: -1 },
  ])('rejects audio outside the accepted limits: $case', ({ durationSeconds, sizeBytes }) => {
    expect(() =>
      SessionAudio.create({
        id: AUDIO_ID,
        durationSeconds,
        sizeBytes,
        contentType: 'audio/webm',
        storagePath: 'account-id/session-id/audio',
      }),
    ).toThrow(ValidationFailedError)
  })
})
