import { describe, expect, it } from 'vitest'

import { describeApiError } from './api-error-presentation'

describe('describeApiError', () => {
  it('returns the registered presentation for a known API error code', () => {
    expect(describeApiError('accounts.ACCOUNT_CREATION_REJECTED')).toEqual({
      messageKey: 'auth.errors.accountCreationRejected',
      presentation: 'toast',
    })
  })

  it('uses the generic toast for an unknown API error code', () => {
    expect(describeApiError('accounts.NEW_ERROR')).toEqual({
      messageKey: 'common.errors.unknown',
      presentation: 'toast',
    })
  })
})
