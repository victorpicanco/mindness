import { describe, expect, it } from 'vitest'

import { SessionsPublicApiImpl } from './index.js'

describe('SessionsPublicApiImpl', () => {
  it('delegates the readability check and returns readability with the failure reason', async () => {
    const readabilityInputs: { sessionId: string; accountId: string }[] = []
    const api = new SessionsPublicApiImpl({
      findProcessingContext: { execute: () => Promise.resolve(null) },
      downloadAudio: {
        execute: () =>
          Promise.resolve({
            bytes: Buffer.from('audio'),
            contentType: 'audio/webm',
            durationSeconds: 30,
          }),
      },
      listStuckProcessing: { execute: () => Promise.resolve([]) },
      checkReadability: {
        execute: (input) => {
          readabilityInputs.push(input)
          return Promise.resolve({ failureReason: 'analysis_timeout', readable: true })
        },
      },
    })

    await expect(api.checkReadability('session-id', 'account-id')).resolves.toEqual({
      failureReason: 'analysis_timeout',
      readable: true,
    })
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
      downloadAudio: {
        execute: () =>
          Promise.resolve({
            bytes: Buffer.from('audio'),
            contentType: 'audio/webm',
            durationSeconds: 30,
          }),
      },
      listStuckProcessing: {
        execute: (input) => {
          listStuckProcessingInputs.push(input)
          return Promise.resolve(['session-id'])
        },
      },
      checkReadability: {
        execute: () => Promise.resolve({ failureReason: null, readable: false }),
      },
    })
    await expect(api.findProcessingContext('session-id')).resolves.toEqual(context)
    await expect(api.downloadAudio('session-id')).resolves.toEqual({
      bytes: Buffer.from('audio'),
      contentType: 'audio/webm',
      durationSeconds: 30,
    })
    await expect(api.listStuckProcessing(before, 50)).resolves.toEqual(['session-id'])
    expect(listStuckProcessingInputs).toEqual([{ before, limit: 50 }])
  })
})
