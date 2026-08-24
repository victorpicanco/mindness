import { describe, expect, it } from 'vitest'

import { signInErrorMessageKey } from './sign-in-error'

describe('signInErrorMessageKey', () => {
  it('has no message when the visitor did not come back from a failure', () => {
    expect(signInErrorMessageKey(undefined)).toBeUndefined()
  })

  it('describes a Google round trip that never returned the tokens', () => {
    expect(signInErrorMessageKey('google_callback_failed')).toBe('auth.errors.googleSignInFailed')
  })

  it('describes an API error code carried by the callback', () => {
    expect(signInErrorMessageKey('accounts.BETA_CAPACITY_REACHED')).toBe(
      'auth.errors.betaCapacityReached',
    )
  })

  it('falls back to the generic message for an unknown code', () => {
    expect(signInErrorMessageKey('something_else')).toBe('common.errors.unknown')
  })

  it('ignores a repeated query parameter', () => {
    expect(signInErrorMessageKey(['google_callback_failed', 'other'])).toBeUndefined()
  })
})
