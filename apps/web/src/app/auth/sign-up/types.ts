import type { ApiErrorDetails } from '@/lib/api/api-error'

export type SignUpActionState =
  | { readonly status: 'idle'; readonly message: null }
  | { readonly status: 'success'; readonly messageKey: 'signUp.success' }
  | {
      readonly status: 'validation-error'
      readonly messageKey: 'errors.invalidEmail' | 'errors.invalidPassword'
    }
  | { readonly status: 'api-error'; readonly error: ApiErrorDetails }

export const initialSignUpActionState: SignUpActionState = { status: 'idle', message: null }
