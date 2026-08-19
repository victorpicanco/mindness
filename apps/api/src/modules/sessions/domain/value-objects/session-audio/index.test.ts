import { describe, expect, it } from 'vitest'

import { ValidationFailedError } from '@/shared/errors/validation-failed-error/index.js'

import { SessionAudio } from './index.js'

describe('SessionAudio', () => {
  it('creates an audio value object within the accepted limits', () => {
    const audio = SessionAudio.create({
      durationSeconds: 60,
      sizeBytes: 25 * 1024 * 1024,
      contentType: 'audio/webm',
      storagePath: 'account-id/session-id/audio.webm',
    })

    expect(audio.durationSeconds).toBe(60)
    expect(audio.sizeBytes).toBe(25 * 1024 * 1024)
    expect(audio.contentType).toBe('audio/webm')
    expect(audio.storagePath).toBe('account-id/session-id/audio.webm')
  })

  it.each([
    { durationSeconds: 0, sizeBytes: 1 },
    { durationSeconds: 60.1, sizeBytes: 1 },
    { durationSeconds: 1, sizeBytes: 25 * 1024 * 1024 + 1 },
  ])('rejects audio outside the accepted limits', ({ durationSeconds, sizeBytes }) => {
    expect(() =>
      SessionAudio.create({
        durationSeconds,
        sizeBytes,
        contentType: 'audio/webm',
        storagePath: 'account-id/session-id/audio.webm',
      }),
    ).toThrow(ValidationFailedError)
  })
})
