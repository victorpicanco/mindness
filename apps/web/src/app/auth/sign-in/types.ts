import type { ApiErrorDetails } from '@/lib/api/api-error'
import type { AuthActionMessageKey } from '../form-validation'

export type SignInActionState =
  | { readonly status: 'idle'; readonly message: null }
  | {
      readonly status: 'error'
      readonly messageKey: AuthActionMessageKey
    }
  | { readonly status: 'api-error'; readonly error: ApiErrorDetails }

export const initialSignInActionState: SignInActionState = { status: 'idle', message: null }
