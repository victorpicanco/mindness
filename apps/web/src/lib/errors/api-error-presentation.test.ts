import { describe, expect, it } from 'vitest'

import { describeApiError } from './api-error-presentation'

describe('describeApiError', () => {
  it('raises rejected credentials as a toast, not as a field error', () => {
    expect(describeApiError('accounts.AUTHENTICATION_REJECTED')).toEqual({
      messageKey: 'auth.errors.authenticationRejected',
      presentation: 'toast',
    })
  })

  it('tells an unconfirmed email apart from wrong credentials', () => {
    expect(describeApiError('accounts.EMAIL_NOT_CONFIRMED')).toEqual({
      messageKey: 'auth.errors.emailNotConfirmed',
      presentation: 'toast',
    })
  })

  it('describes a throttled request', () => {
    expect(describeApiError('accounts.RATE_LIMITED')).toEqual({
      messageKey: 'auth.errors.rateLimited',
      presentation: 'toast',
    })
  })

  it('describes a blocked account', () => {
    expect(describeApiError('accounts.ACCOUNT_BLOCKED')).toEqual({
      messageKey: 'auth.errors.accountBlocked',
      presentation: 'toast',
    })
  })

  it('describes a sign-up the provider refuses to start', () => {
    expect(describeApiError('accounts.SIGN_UP_NOT_ALLOWED')).toEqual({
      messageKey: 'auth.errors.signUpNotAllowed',
      presentation: 'toast',
    })
  })

  it('describes a Google round trip that never returned the tokens', () => {
    expect(describeApiError('web.GOOGLE_SIGN_IN_FAILED')).toEqual({
      messageKey: 'auth.errors.googleSignInFailed',
      presentation: 'toast',
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

  it('raises the beta capacity limit as a toast', () => {
    expect(describeApiError('accounts.BETA_CAPACITY_REACHED')).toEqual({
      messageKey: 'auth.errors.betaCapacityReached',
      presentation: 'toast',
    })
  })

  it('keeps a duplicated email next to the field that has to change', () => {
    expect(describeApiError('accounts.ACCOUNT_ALREADY_EXISTS')).toEqual({
      messageKey: 'auth.errors.accountAlreadyExists',
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

  // The recording screen renders each of these next to its own retry and discard controls, so the
  // toast handler stays out of them.
  it.each([
    ['sessions.AUDIO_SIZE_REJECTED', 'home.research.audioSizeRejected'],
    ['sessions.AUDIO_VALIDATION_REJECTED', 'home.research.audioValidationRejected'],
    ['sessions.AUDIO_UPLOAD_FAILED', 'home.research.audioUploadFailed'],
    ['web.AUDIO_UPLOAD_FAILED', 'home.research.audioUploadFailed'],
    ['sessions.SESSION_NOT_IN_PROGRESS', 'home.research.sessionNotInProgress'],
    ['web.MICROPHONE_UNAVAILABLE', 'home.research.microphoneError'],
  ] as const)('keeps %s on the recording screen', (code, messageKey) => {
    expect(describeApiError(code)).toEqual({ messageKey, presentation: 'inline' })
  })

  it.each([
    ['sessions.THEME_UNAVAILABLE', 'home.practice.errors.themeUnavailable'],
    ['sessions.PRACTICE_NOT_ALLOWED', 'home.practice.errors.practiceNotAllowed'],
  ] as const)('keeps the blocking %s on the practice form', (code, messageKey) => {
    expect(describeApiError(code)).toEqual({ messageKey, presentation: 'inline' })
  })

  it('describes a missing API base URL as an unexpected failure', () => {
    expect(describeApiError('web.ENVIRONMENT_INVALID')).toEqual({
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

  it('raises a session that is still processing as a toast on the deletion attempt', () => {
    expect(describeApiError('sessions.SESSION_NOT_DELETABLE')).toEqual({
      messageKey: 'common.errors.sessionNotDeletable',
      presentation: 'toast',
    })
  })
})
