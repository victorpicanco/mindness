import { describe, expect, it } from 'vitest'

import { SessionsAudioReaderAdapter } from './index.js'

describe('SessionsAudioReaderAdapter', () => {
  it('delegates audio reads to sessions and keeps the validated metadata', async () => {
    const content = {
      bytes: Buffer.from('audio'),
      contentType: 'audio/webm',
      durationSeconds: 30,
    }
    const adapter = new SessionsAudioReaderAdapter({
      downloadAudio: () => Promise.resolve(content),
    })

    await expect(adapter.read('session-id')).resolves.toBe(content)
  })
})
