import { describe, expect, it } from 'vitest'

import { SessionsPublicApiImpl } from './index.js'

describe('SessionsPublicApiImpl', () => {
  it('translates every public use case output', async () => {
    const context = {
      sessionId: 'session-id',
      accountId: 'account-id',
      themeId: 'theme-id',
      audioPath: 'audio-path',
      recordedAt: new Date('2026-08-21T12:00:00.000Z'),
    }
    const before = new Date('2026-08-21T12:05:00.000Z')
    const listStuckProcessingInputs: { before: Date; limit: number }[] = []
    const api = new SessionsPublicApiImpl({
      findProcessingContext: { execute: () => Promise.resolve(context) },
      downloadAudio: { execute: () => Promise.resolve(Buffer.from('audio')) },
      listStuckProcessing: {
        execute: (input) => {
          listStuckProcessingInputs.push(input)
          return Promise.resolve(['session-id'])
        },
      },
    })
    await expect(api.findProcessingContext('session-id')).resolves.toEqual(context)
    await expect(api.downloadAudio('session-id')).resolves.toEqual(Buffer.from('audio'))
    await expect(api.listStuckProcessing(before, 50)).resolves.toEqual(['session-id'])
    expect(listStuckProcessingInputs).toEqual([{ before, limit: 50 }])
  })
})
