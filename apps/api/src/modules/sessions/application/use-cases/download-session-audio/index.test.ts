import { describe, expect, it } from 'vitest'

import { DownloadSessionAudioUseCase } from './index.js'

describe('DownloadSessionAudioUseCase', () => {
  it('downloads the audio using the session storage path', async () => {
    const audio = Buffer.from('audio')
    const useCase = new DownloadSessionAudioUseCase({
      sessions: {
        findById: () => Promise.resolve({ id: 'session-id', audio: { storagePath: 'audio-path' } }),
      },
      audioStorage: {
        downloadObject: (path: string) =>
          Promise.resolve(path === 'audio-path' ? audio : Buffer.alloc(0)),
      },
    })
    await expect(useCase.execute({ sessionId: 'session-id' })).resolves.toBe(audio)
  })
})
