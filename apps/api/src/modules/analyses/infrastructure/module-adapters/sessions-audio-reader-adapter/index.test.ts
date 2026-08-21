import { describe, expect, it } from 'vitest'
import { SessionsAudioReaderAdapter } from './index.js'
describe('SessionsAudioReaderAdapter', () => {
  it('delegates audio downloads to sessions', async () => {
    const audio = Buffer.from('audio')
    const adapter = new SessionsAudioReaderAdapter({ downloadAudio: () => Promise.resolve(audio) })
    await expect(adapter.read('session-id')).resolves.toBe(audio)
  })
})
