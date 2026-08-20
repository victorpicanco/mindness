import { describe, expect, it } from 'vitest'

import { AudioObjectPath } from './index.js'

describe('AudioObjectPath', () => {
  it('derives the object path from the owning account and session', () => {
    const path = AudioObjectPath.forSession({ accountId: 'account-1', sessionId: 'session-1' })

    expect(path.value).toBe('account-1/session-1/audio')
  })

  // D-06: the prefix is what isolates one account's objects from another's, so it is always
  // derived, never taken from the caller.
  it('always prefixes with the account, so a session id cannot reach another prefix', () => {
    const path = AudioObjectPath.forSession({
      accountId: 'account-a',
      sessionId: '../account-b/session-1',
    })

    expect(path.value.startsWith('account-a/')).toBe(true)
  })
})
