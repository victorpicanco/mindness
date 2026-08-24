export type ApiErrorPresentation = 'inline' | 'silent' | 'toast'

export type ApiErrorMessageKey =
  | 'auth.errors.accountAlreadyExists'
  | 'auth.errors.accountNotFound'
  | 'auth.errors.authenticationRejected'
  | 'auth.errors.betaCapacityReached'
  | 'auth.errors.captchaFailed'
  | 'auth.errors.captchaRequired'
  | 'auth.errors.invalidEmail'
  | 'auth.errors.invalidPassword'
  | 'auth.errors.reauthenticationRequired'
  | 'auth.errors.sessionExpired'
  | 'common.errors.network'
  | 'common.errors.unknown'
  | 'common.errors.validationFailed'

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
  'accounts.AUTHENTICATION_REJECTED': {
    messageKey: 'auth.errors.authenticationRejected',
    presentation: 'inline',
  },
  'accounts.BETA_CAPACITY_REACHED': {
    messageKey: 'auth.errors.betaCapacityReached',
    presentation: 'inline',
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
  'shared.INTERNAL_ERROR': UNKNOWN_API_ERROR,
  'shared.VALIDATION_FAILED': {
    messageKey: 'common.errors.validationFailed',
    presentation: 'inline',
  },
  'web.API_BASE_URL_MISSING': UNKNOWN_API_ERROR,
  'web.API_REQUEST_FAILED': {
    messageKey: 'common.errors.network',
    presentation: 'toast',
  },
  'web.API_RESPONSE_INVALID': UNKNOWN_API_ERROR,
  'web.AUTHENTICATION_EXPIRED': {
    messageKey: 'auth.errors.sessionExpired',
    presentation: 'toast',
  },
  'web.UNEXPECTED_ERROR': UNKNOWN_API_ERROR,
}

export function describeApiError(code: string): ApiErrorDescription {
  return API_ERROR_DESCRIPTIONS[code] ?? UNKNOWN_API_ERROR
}
