import { describe, expect, it } from 'vitest'

import { SessionsPublicApiImpl } from './index.js'

describe('SessionsPublicApiImpl', () => {
  it('delegates the session readability check and returns its boolean output', async () => {
    const readabilityInputs: { sessionId: string; accountId: string }[] = []
    const api = new SessionsPublicApiImpl({
      findProcessingContext: { execute: () => Promise.resolve(null) },
      downloadAudio: { execute: () => Promise.resolve(Buffer.from('audio')) },
      listStuckProcessing: { execute: () => Promise.resolve([]) },
      checkReadability: {
        execute: (input) => {
          readabilityInputs.push(input)
          return Promise.resolve({ readable: true })
        },
      },
    })

    await expect(api.isReadableByAccount('session-id', 'account-id')).resolves.toBe(true)
    expect(readabilityInputs).toEqual([{ sessionId: 'session-id', accountId: 'account-id' }])
  })

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
      checkReadability: { execute: () => Promise.resolve({ readable: false }) },
    })
    await expect(api.findProcessingContext('session-id')).resolves.toEqual(context)
    await expect(api.downloadAudio('session-id')).resolves.toEqual(Buffer.from('audio'))
    await expect(api.listStuckProcessing(before, 50)).resolves.toEqual(['session-id'])
    expect(listStuckProcessingInputs).toEqual([{ before, limit: 50 }])
  })
})
