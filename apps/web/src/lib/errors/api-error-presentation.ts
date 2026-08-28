type ApiErrorPresentation = 'inline' | 'silent' | 'toast'

export type ApiErrorMessageKey =
  | 'auth.errors.accountAlreadyExists'
  | 'auth.errors.accountBlocked'
  | 'auth.errors.accountNotFound'
  | 'auth.errors.authenticationRejected'
  | 'auth.errors.betaCapacityReached'
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
  | 'common.errors.unknown'
  | 'common.errors.validationFailed'
  | 'home.practice.errors.practiceNotAllowed'
  | 'home.practice.errors.quotaExhausted'
  | 'home.practice.errors.themeUnavailable'
  | 'home.research.audioSizeRejected'
  | 'home.research.audioUploadFailed'
  | 'home.research.audioValidationRejected'
  | 'home.research.microphoneError'
  | 'home.research.sessionNotInProgress'

export type ApiErrorDescription = {
  readonly messageKey: ApiErrorMessageKey
  readonly presentation: ApiErrorPresentation
}

const UNKNOWN_API_ERROR: ApiErrorDescription = {
  messageKey: 'common.errors.unknown',
  presentation: 'toast',
}

const API_ERROR_DESCRIPTIONS: Readonly<Record<string, ApiErrorDescription>> = {
  'accounts.ACCOUNT_ALREADY_EXISTS': {
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
  'accounts.BETA_CAPACITY_REACHED': {
    messageKey: 'auth.errors.betaCapacityReached',
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
    messageKey: 'auth.errors.captchaFailed',
    presentation: 'inline',
  },
  'accounts.INVALID_ACCOUNT_VALUE': {
    messageKey: 'auth.errors.invalidPassword',
    presentation: 'inline',
  },
  'accounts.REAUTHENTICATION_REQUIRED': {
    messageKey: 'auth.errors.reauthenticationRequired',
    presentation: 'toast',
  },
  'quota.QUOTA_EXHAUSTED': {
    messageKey: 'home.practice.errors.quotaExhausted',
    presentation: 'inline',
  },
  'sessions.AUDIO_SIZE_REJECTED': {
    messageKey: 'home.research.audioSizeRejected',
    presentation: 'inline',
  },
  'sessions.AUDIO_UPLOAD_FAILED': {
    messageKey: 'home.research.audioUploadFailed',
    presentation: 'inline',
  },
  'sessions.AUDIO_VALIDATION_REJECTED': {
    messageKey: 'home.research.audioValidationRejected',
    presentation: 'inline',
  },
  'sessions.PRACTICE_NOT_ALLOWED': {
    messageKey: 'home.practice.errors.practiceNotAllowed',
    presentation: 'inline',
  },
  'sessions.SESSION_NOT_IN_PROGRESS': {
    messageKey: 'home.research.sessionNotInProgress',
    presentation: 'inline',
  },
  'sessions.THEME_UNAVAILABLE': {
    messageKey: 'home.practice.errors.themeUnavailable',
    presentation: 'inline',
  },
  'shared.INTERNAL_ERROR': UNKNOWN_API_ERROR,
  'shared.VALIDATION_FAILED': {
    messageKey: 'common.errors.validationFailed',
    presentation: 'inline',
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
    presentation: 'inline',
  },
  'web.MICROPHONE_UNAVAILABLE': {
    messageKey: 'home.research.microphoneError',
    presentation: 'inline',
  },
  'web.UNEXPECTED_ERROR': UNKNOWN_API_ERROR,
}

export function describeApiError(code: string): ApiErrorDescription {
  return API_ERROR_DESCRIPTIONS[code] ?? UNKNOWN_API_ERROR
}
