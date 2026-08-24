export type ApiErrorPresentation = 'inline' | 'silent' | 'toast'

export type ApiErrorMessageKey =
  | 'auth.errors.accountCreationRejected'
  | 'auth.errors.authenticationRejected'
  | 'common.errors.network'
  | 'common.errors.unknown'

export type ApiErrorDescription = {
  readonly messageKey: ApiErrorMessageKey
  readonly presentation: ApiErrorPresentation
}

const UNKNOWN_API_ERROR: ApiErrorDescription = {
  messageKey: 'common.errors.unknown',
  presentation: 'toast',
}

const API_ERROR_DESCRIPTIONS: Readonly<Record<string, ApiErrorDescription>> = {
  'accounts.ACCOUNT_CREATION_REJECTED': {
    messageKey: 'auth.errors.accountCreationRejected',
    presentation: 'toast',
  },
  'accounts.AUTHENTICATION_REJECTED': {
    messageKey: 'auth.errors.authenticationRejected',
    presentation: 'inline',
  },
  'web.API_REQUEST_FAILED': {
    messageKey: 'common.errors.network',
    presentation: 'toast',
  },
  'web.API_RESPONSE_INVALID': {
    messageKey: 'common.errors.unknown',
    presentation: 'toast',
  },
  'web.UNEXPECTED_ERROR': UNKNOWN_API_ERROR,
}

export function describeApiError(code: string): ApiErrorDescription {
  return API_ERROR_DESCRIPTIONS[code] ?? UNKNOWN_API_ERROR
}
