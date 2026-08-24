import type { ApiErrorMessageKey } from '@/lib/errors/api-error-presentation'

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u

export type AuthFormMessageKey =
  | ApiErrorMessageKey
  | 'auth.errors.captchaUnavailable'
  | 'auth.errors.googleSignInFailed'
  | 'auth.errors.passwordMismatch'
  | 'auth.errors.passwordRequired'

export type AuthActionMessageKey =
  'errors.captchaRequired' | 'errors.invalidEmail' | 'errors.invalidPassword'

export type AuthFieldName = 'captchaToken' | 'email' | 'password' | 'passwordConfirmation'

const FIELD_BY_ACTION_MESSAGE_KEY: Readonly<Record<AuthActionMessageKey, AuthFieldName>> = {
  'errors.captchaRequired': 'captchaToken',
  'errors.invalidEmail': 'email',
  'errors.invalidPassword': 'password',
}

export function fieldOfActionMessageKey(messageKey: AuthActionMessageKey): AuthFieldName {
  return FIELD_BY_ACTION_MESSAGE_KEY[messageKey]
}

export function formFieldValue(formData: FormData, field: string): string {
  const value = formData.get(field)

  return typeof value === 'string' ? value : ''
}
