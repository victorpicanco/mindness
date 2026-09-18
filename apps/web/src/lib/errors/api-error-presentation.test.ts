import { describe, expect, it } from 'vitest'

import { API_ERROR_CODES, describeApiError } from './api-error-presentation'

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

  it.each([
    ['accounts.CAPTCHA_REJECTED', 'auth.errors.captchaFailed', 'captchaToken'],
    ['accounts.ACCOUNT_ALREADY_EXISTS', 'auth.errors.accountAlreadyExists', 'email'],
    ['accounts.INVALID_ACCOUNT_VALUE', 'auth.errors.invalidPassword', 'password'],
  ] as const)(
    'binds the inline %s to the field the user has to correct',
    (code, messageKey, field) => {
      expect(describeApiError(code)).toEqual({ field, messageKey, presentation: 'inline' })
    },
  )

  it('never describes an inline error without the field that owns it', () => {
    const inlineWithoutField = API_ERROR_CODES.map((code) => describeApiError(code)).filter(
      (description) => description.presentation === 'inline' && !('field' in description),
    )

    expect(inlineWithoutField).toEqual([])
  })

  it.each([
    ['sessions.AUDIO_SIZE_REJECTED', 'home.research.audioSizeRejected'],
    ['sessions.AUDIO_VALIDATION_REJECTED', 'home.research.audioValidationRejected'],
    ['sessions.AUDIO_UPLOAD_FAILED', 'home.research.audioUploadFailed'],
    ['web.AUDIO_UPLOAD_FAILED', 'home.research.audioUploadFailed'],
    ['sessions.SESSION_NOT_IN_PROGRESS', 'home.research.sessionNotInProgress'],
    ['web.MICROPHONE_UNAVAILABLE', 'home.research.microphoneError'],
    ['sessions.PRACTICE_NOT_ALLOWED', 'home.practice.errors.practiceNotAllowed'],
  ] as const)('interrupts the flow with a dialog on %s', (code, messageKey) => {
    expect(describeApiError(code)).toEqual({ messageKey, presentation: 'dialog' })
  })

  it.each([
    ['sessions.THEME_UNAVAILABLE', 'home.practice.errors.themeUnavailable'],
    ['shared.VALIDATION_FAILED', 'common.errors.validationFailed'],
  ] as const)('raises the recoverable %s as a toast', (code, messageKey) => {
    expect(describeApiError(code)).toEqual({ messageKey, presentation: 'toast' })
  })

  it('keeps the consumed guest trial silent so the dialog can take over', () => {
    expect(describeApiError('sessions.GUEST_TRIAL_CONSUMED')).toEqual({
      messageKey: 'home.practice.accountEntryDialog.accountRequired.description',
      presentation: 'silent',
    })
  })
})
