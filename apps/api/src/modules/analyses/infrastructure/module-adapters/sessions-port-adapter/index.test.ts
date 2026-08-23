import { describe, expect, it } from 'vitest'
import { SessionsPortAdapter } from './index.js'
describe('SessionsPortAdapter', () => {
  it('translates the sessions public context and preserves null', async () => {
    const adapter = new SessionsPortAdapter({
      findProcessingContext: () => Promise.resolve(null),
      listStuckProcessing: () => Promise.resolve([]),
      isReadableByAccount: () => Promise.resolve(false),
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
        return Promise.resolve(['session-1'])
      },
      isReadableByAccount: () => Promise.resolve(false),
    })

    await expect(adapter.listStuckProcessing(before, 25)).resolves.toEqual(['session-1'])
    expect(calls).toEqual([{ before, limit: 25 }])
  })

  it('delegates session readability to the sessions public API', async () => {
    const calls: { sessionId: string; accountId: string }[] = []
    const sessions = {
      findProcessingContext: () => Promise.resolve(null),
      listStuckProcessing: () => Promise.resolve([]),
      isReadableByAccount: (sessionId: string, accountId: string) => {
        calls.push({ sessionId, accountId })
        return Promise.resolve(true)
      },
    }
    const adapter = new SessionsPortAdapter(sessions)

    await expect(adapter.isReadableByAccount('session-id', 'account-id')).resolves.toBe(true)
    expect(calls).toEqual([{ sessionId: 'session-id', accountId: 'account-id' }])
  })
})
