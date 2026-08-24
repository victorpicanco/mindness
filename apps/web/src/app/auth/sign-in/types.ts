import type { ApiErrorDetails } from '@/lib/api/api-error'

export type SignInActionState =
  | { readonly status: 'idle'; readonly message: null }
  | {
      readonly status: 'error'
      readonly messageKey: 'errors.invalidEmail' | 'errors.invalidPassword'
    }
  | { readonly status: 'api-error'; readonly error: ApiErrorDetails }

export const initialSignInActionState: SignInActionState = { status: 'idle', message: null }
