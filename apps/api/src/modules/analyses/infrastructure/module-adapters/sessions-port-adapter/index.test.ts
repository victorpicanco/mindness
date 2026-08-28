import { describe, expect, it } from 'vitest'

import { SessionsPortAdapter } from './index.js'

describe('SessionsPortAdapter', () => {
  it('translates the sessions public context and preserves null', async () => {
    const adapter = new SessionsPortAdapter({
      findProcessingContext: () => Promise.resolve(null),
      listStuckProcessing: () => Promise.resolve([]),
      checkReadability: () => Promise.resolve({ failureReason: null, readable: false }),
    })
    await expect(adapter.findProcessingContext('session-id')).resolves.toBeNull()
  })

  it('delegates listStuckProcessing to the sessions public API', async () => {
    const before = new Date('2026-08-21T12:00:00.000Z')
    const calls: { before: Date; limit: number }[] = []
    const adapter = new SessionsPortAdapter({
      findProcessingContext: () => Promise.resolve(null),
      listStuckProcessing: (queriedBefore, limit) => {
        calls.push({ before: queriedBefore, limit })
        return Promise.resolve(['session-id'])
      },
      checkReadability: () => Promise.resolve({ failureReason: null, readable: false }),
    })

    await expect(adapter.listStuckProcessing(before, 25)).resolves.toEqual(['session-id'])
    expect(calls).toEqual([{ before, limit: 25 }])
  })

  it('translates the readability check into the analysis access of the port', async () => {
    const calls: { sessionId: string; accountId: string }[] = []
    const sessions = {
      findProcessingContext: () => Promise.resolve(null),
      listStuckProcessing: () => Promise.resolve([]),
      checkReadability: (sessionId: string, accountId: string) => {
        calls.push({ sessionId, accountId })
        return Promise.resolve({ failureReason: 'analysis_timeout' as const, readable: true })
      },
    }
    const adapter = new SessionsPortAdapter(sessions)

    await expect(adapter.checkAnalysisAccess('session-id', 'account-id')).resolves.toEqual({
      failure: 'analysis_timeout',
      readable: true,
    })
    expect(calls).toEqual([{ sessionId: 'session-id', accountId: 'account-id' }])
  })
})
