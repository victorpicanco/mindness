import { describe, expect, it } from 'vitest'

import { AUDIO_PLAYBACK_URL_TTL_SECONDS, AudioPlaybackWindow } from './index.js'

describe('AudioPlaybackWindow', () => {
  it('keeps the credential lifetime within the product requirement range', () => {
    expect(AUDIO_PLAYBACK_URL_TTL_SECONDS).toBeGreaterThanOrEqual(60)
    expect(AUDIO_PLAYBACK_URL_TTL_SECONDS).toBeLessThanOrEqual(300)
  })

  it('derives the expiration instant from the provided clock instant', () => {
    const now = new Date('2026-08-22T12:00:00.000Z')

    expect(AudioPlaybackWindow.from(now)).toEqual({
      expiresInSeconds: AUDIO_PLAYBACK_URL_TTL_SECONDS,
      expiresAt: new Date(now.getTime() + AUDIO_PLAYBACK_URL_TTL_SECONDS * 1000),
    })
  })
})
