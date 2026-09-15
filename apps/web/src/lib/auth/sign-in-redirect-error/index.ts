import { describeApiError, type ApiErrorDescription } from '@/lib/errors/api-error-presentation'

const GOOGLE_CALLBACK_FAILED = 'google_callback_failed'
const GOOGLE_SIGN_IN_FAILED_CODE = 'web.GOOGLE_SIGN_IN_FAILED'

export function describeSignInRedirectError(
  error: string | string[] | undefined,
): ApiErrorDescription | undefined {
  if (typeof error !== 'string') return undefined

  return describeApiError(error === GOOGLE_CALLBACK_FAILED ? GOOGLE_SIGN_IN_FAILED_CODE : error)
}
