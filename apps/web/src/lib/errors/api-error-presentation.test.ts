import { describe, expect, it } from 'vitest'

import { describeApiError } from './api-error-presentation'

describe('describeApiError', () => {
  it('returns the registered presentation for a known API error code', () => {
    expect(describeApiError('accounts.AUTHENTICATION_REJECTED')).toEqual({
      messageKey: 'auth.errors.authenticationRejected',
      presentation: 'inline',
    })
  })

  it('uses the generic toast for an unknown API error code', () => {
    expect(describeApiError('accounts.NEW_ERROR')).toEqual({
      messageKey: 'common.errors.unknown',
      presentation: 'toast',
    })
  })

  it('describes the rejected captcha inline so the form can reset the widget', () => {
    expect(describeApiError('accounts.CAPTCHA_REJECTED')).toEqual({
      messageKey: 'auth.errors.captchaFailed',
      presentation: 'inline',
    })
  })

  it('describes a request the API refused to validate', () => {
    expect(describeApiError('shared.VALIDATION_FAILED')).toEqual({
      messageKey: 'common.errors.validationFailed',
      presentation: 'inline',
    })
  })

  it('describes the beta capacity limit inline', () => {
    expect(describeApiError('accounts.BETA_CAPACITY_REACHED')).toEqual({
      messageKey: 'auth.errors.betaCapacityReached',
      presentation: 'inline',
    })
  })

  it('describes an account the API could not find', () => {
    expect(describeApiError('accounts.ACCOUNT_NOT_FOUND')).toEqual({
      messageKey: 'auth.errors.accountNotFound',
      presentation: 'toast',
    })
  })

  it('describes an expired session as a toast', () => {
    expect(describeApiError('web.AUTHENTICATION_EXPIRED')).toEqual({
      messageKey: 'auth.errors.sessionExpired',
      presentation: 'toast',
    })
  })

  it('describes a missing API base URL as an unexpected failure', () => {
    expect(describeApiError('web.API_BASE_URL_MISSING')).toEqual({
      messageKey: 'common.errors.unknown',
      presentation: 'toast',
    })
  })

  it('describes an internal API failure as an unexpected failure', () => {
    expect(describeApiError('shared.INTERNAL_ERROR')).toEqual({
      messageKey: 'common.errors.unknown',
      presentation: 'toast',
    })
  })
})
