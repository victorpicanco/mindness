import type { ApiErrorDetails } from '@/lib/api/api-error'

import type { AuthActionMessageKey } from './form-validation'

export type AuthActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | { readonly status: 'validation-error'; readonly messageKey: AuthActionMessageKey }
  | { readonly status: 'api-error'; readonly error: ApiErrorDetails }

export const initialAuthActionState: AuthActionState = { status: 'idle' }
