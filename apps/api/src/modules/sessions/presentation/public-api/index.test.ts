import { describe, expect, it } from 'vitest'

import { SessionsPublicApiImpl } from './index.js'

describe('SessionsPublicApiImpl', () => {
  it('translates both public use case outputs', async () => {
    const context = {
      sessionId: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      audioPath: 'audio-path',
      recordedAt: new Date('2026-08-21T12:00:00.000Z'),
    }
    const api = new SessionsPublicApiImpl({
      findProcessingContext: { execute: () => Promise.resolve(context) },
      downloadAudio: { execute: () => Promise.resolve(Buffer.from('audio')) },
    })
    await expect(api.findProcessingContext('session-id')).resolves.toEqual(context)
    await expect(api.downloadAudio('session-id')).resolves.toEqual(Buffer.from('audio'))
  })
})
