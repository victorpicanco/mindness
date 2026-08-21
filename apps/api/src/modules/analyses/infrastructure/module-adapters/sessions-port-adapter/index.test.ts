import { describe, expect, it } from 'vitest'
import { SessionsPortAdapter } from './index.js'
describe('SessionsPortAdapter', () => {
  it('translates the sessions public context and preserves null', async () => {
    const adapter = new SessionsPortAdapter({ findProcessingContext: () => Promise.resolve(null) })
    await expect(adapter.findProcessingContext('session-id')).resolves.toBeNull()
  })
})
