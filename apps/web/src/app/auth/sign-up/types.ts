import type { ApiErrorDetails } from '@/lib/api/api-error'
import type { AuthActionMessageKey } from '../form-validation'

export type SignUpActionState =
  | { readonly status: 'idle'; readonly message: null }
  | { readonly status: 'success'; readonly messageKey: 'signUp.success' }
  | {
      readonly status: 'validation-error'
      readonly messageKey: AuthActionMessageKey
    }
  | { readonly status: 'api-error'; readonly error: ApiErrorDetails }

export const initialSignUpActionState: SignUpActionState = { status: 'idle', message: null }
