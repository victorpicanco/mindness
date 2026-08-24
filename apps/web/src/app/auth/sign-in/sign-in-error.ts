import { describeApiError } from '@/lib/errors/api-error-presentation'

import type { AuthFormMessageKey } from '../form-validation'

const GOOGLE_CALLBACK_FAILED = 'google_callback_failed'

export function signInErrorMessageKey(
  error: string | string[] | undefined,
): AuthFormMessageKey | undefined {
  if (typeof error !== 'string') return undefined

  if (error === GOOGLE_CALLBACK_FAILED) return 'auth.errors.googleSignInFailed'

  return describeApiError(error).messageKey
}
