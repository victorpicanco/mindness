import { describe, expect, it } from 'vitest'

import { describeSignInRedirectError } from './sign-in-error'

describe('describeSignInRedirectError', () => {
  it('has no message when the visitor did not come back from a failure', () => {
    expect(describeSignInRedirectError(undefined)).toBeUndefined()
  })

  it('raises a Google round trip that never returned the tokens as a toast', () => {
    expect(describeSignInRedirectError('google_callback_failed')).toEqual({
      messageKey: 'auth.errors.googleSignInFailed',
      presentation: 'toast',
    })
  })

  it('describes an API error code carried by the callback', () => {
    expect(describeSignInRedirectError('accounts.BETA_CAPACITY_REACHED')).toEqual({
      messageKey: 'auth.errors.betaCapacityReached',
      presentation: 'toast',
    })
  })

  it('falls back to the generic message for an unknown code', () => {
    expect(describeSignInRedirectError('something_else')).toEqual({
      messageKey: 'common.errors.unknown',
      presentation: 'toast',
    })
  })

  it('ignores a repeated query parameter', () => {
    expect(describeSignInRedirectError(['google_callback_failed', 'other'])).toBeUndefined()
  })
})
