import { describe, expect, it } from 'vitest'
import { SessionsPortAdapter } from './index.js'
describe('SessionsPortAdapter', () => {
  it('translates the sessions public context and preserves null', async () => {
    const adapter = new SessionsPortAdapter({
      findProcessingContext: () => Promise.resolve(null),
      listStuckProcessing: () => Promise.resolve([]),
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
    })

    await expect(adapter.listStuckProcessing(before, 25)).resolves.toEqual(['session-1'])
    expect(calls).toEqual([{ before, limit: 25 }])
  })
})
