export type ApiErrorField = 'captchaToken' | 'email' | 'password'

export type ApiErrorMessageKey =
  | 'auth.errors.accountAlreadyExists'
  | 'auth.errors.accountBlocked'
  | 'auth.errors.accountNotFound'
  | 'auth.errors.authenticationRejected'
  | 'auth.errors.captchaFailed'
  | 'auth.errors.captchaRequired'
  | 'auth.errors.emailNotConfirmed'
  | 'auth.errors.googleSignInFailed'
  | 'auth.errors.invalidEmail'
  | 'auth.errors.invalidPassword'
  | 'auth.errors.rateLimited'
  | 'auth.errors.reauthenticationRequired'
  | 'auth.errors.sessionExpired'
  | 'auth.errors.signUpNotAllowed'
  | 'common.errors.network'
  | 'common.errors.sessionNotDeletable'
  | 'common.errors.unknown'
  | 'common.errors.validationFailed'
  | 'home.practice.accountEntryDialog.accountRequired.description'
  | 'home.practice.errors.practiceNotAllowed'
  | 'home.practice.errors.themeUnavailable'
  | 'home.research.audioSizeRejected'
  | 'home.research.audioUploadFailed'
  | 'home.research.audioValidationRejected'
  | 'home.research.microphoneError'
  | 'home.research.sessionNotInProgress'

export type ApiErrorDescription =
  | {
      readonly field: ApiErrorField
      readonly messageKey: ApiErrorMessageKey
      readonly presentation: 'inline'
    }
  | {
      readonly messageKey: ApiErrorMessageKey
      readonly presentation: 'dialog' | 'silent' | 'toast'
    }

const UNKNOWN_API_ERROR: ApiErrorDescription = {
  messageKey: 'common.errors.unknown',
  presentation: 'toast',
}

const API_ERROR_DESCRIPTIONS = {
  'accounts.ACCOUNT_ALREADY_EXISTS': {
    field: 'email',
    messageKey: 'auth.errors.accountAlreadyExists',
    presentation: 'inline',
  },
  'accounts.ACCOUNT_NOT_FOUND': {
    messageKey: 'auth.errors.accountNotFound',
    presentation: 'toast',
  },
  'accounts.ACCOUNT_BLOCKED': {
    messageKey: 'auth.errors.accountBlocked',
    presentation: 'toast',
  },
  'accounts.AUTHENTICATION_REJECTED': {
    messageKey: 'auth.errors.authenticationRejected',
    presentation: 'toast',
  },
  'accounts.EMAIL_NOT_CONFIRMED': {
    messageKey: 'auth.errors.emailNotConfirmed',
    presentation: 'toast',
  },
  'accounts.RATE_LIMITED': {
    messageKey: 'auth.errors.rateLimited',
    presentation: 'toast',
  },
  'accounts.SIGN_UP_NOT_ALLOWED': {
    messageKey: 'auth.errors.signUpNotAllowed',
    presentation: 'toast',
  },
  'accounts.CAPTCHA_REJECTED': {
    field: 'captchaToken',
    messageKey: 'auth.errors.captchaFailed',
    presentation: 'inline',
  },
  'accounts.INVALID_ACCOUNT_VALUE': {
    field: 'password',
    messageKey: 'auth.errors.invalidPassword',
    presentation: 'inline',
  },
  'accounts.REAUTHENTICATION_REQUIRED': {
    messageKey: 'auth.errors.reauthenticationRequired',
    presentation: 'toast',
  },
  'sessions.AUDIO_SIZE_REJECTED': {
    messageKey: 'home.research.audioSizeRejected',
    presentation: 'dialog',
  },
  'sessions.AUDIO_UPLOAD_FAILED': {
    messageKey: 'home.research.audioUploadFailed',
    presentation: 'dialog',
  },
  'sessions.AUDIO_VALIDATION_REJECTED': {
    messageKey: 'home.research.audioValidationRejected',
    presentation: 'dialog',
  },
  'sessions.GUEST_TRIAL_CONSUMED': {
    messageKey: 'home.practice.accountEntryDialog.accountRequired.description',
    presentation: 'silent',
  },
  'sessions.PRACTICE_NOT_ALLOWED': {
    messageKey: 'home.practice.errors.practiceNotAllowed',
    presentation: 'dialog',
  },
  'sessions.SESSION_NOT_DELETABLE': {
    messageKey: 'common.errors.sessionNotDeletable',
    presentation: 'toast',
  },
  'sessions.SESSION_NOT_IN_PROGRESS': {
    messageKey: 'home.research.sessionNotInProgress',
    presentation: 'dialog',
  },
  'sessions.THEME_UNAVAILABLE': {
    messageKey: 'home.practice.errors.themeUnavailable',
    presentation: 'toast',
  },
  'shared.INTERNAL_ERROR': UNKNOWN_API_ERROR,
  'shared.VALIDATION_FAILED': {
    messageKey: 'common.errors.validationFailed',
    presentation: 'toast',
  },
  'web.ENVIRONMENT_INVALID': UNKNOWN_API_ERROR,
  'web.API_REQUEST_FAILED': {
    messageKey: 'common.errors.network',
    presentation: 'toast',
  },
  'web.API_RESPONSE_INVALID': UNKNOWN_API_ERROR,
  'web.GOOGLE_SIGN_IN_FAILED': {
    messageKey: 'auth.errors.googleSignInFailed',
    presentation: 'toast',
  },
  'web.AUTHENTICATION_EXPIRED': {
    messageKey: 'auth.errors.sessionExpired',
    presentation: 'toast',
  },
  'web.AUDIO_UPLOAD_FAILED': {
    messageKey: 'home.research.audioUploadFailed',
    presentation: 'dialog',
  },
  'web.MICROPHONE_UNAVAILABLE': {
    messageKey: 'home.research.microphoneError',
    presentation: 'dialog',
  },
  'web.UNEXPECTED_ERROR': UNKNOWN_API_ERROR,
} as const satisfies Readonly<Record<string, ApiErrorDescription>>

export const API_ERROR_CODES: readonly string[] = Object.keys(API_ERROR_DESCRIPTIONS)

export function describeApiError(code: string): ApiErrorDescription {
  const descriptions: Readonly<Record<string, ApiErrorDescription>> = API_ERROR_DESCRIPTIONS

  return descriptions[code] ?? UNKNOWN_API_ERROR
}
