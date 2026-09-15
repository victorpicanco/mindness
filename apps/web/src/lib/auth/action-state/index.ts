import type { ApiErrorDetails } from '@/lib/api/api-error'

import type { AuthActionMessageKey } from '@/lib/auth/form-validation'

export type AuthActionState =
  | { readonly status: 'idle' }
  | { readonly status: 'success' }
  | { readonly status: 'validation-error'; readonly messageKey: AuthActionMessageKey }
  | { readonly status: 'api-error'; readonly error: ApiErrorDetails }

export const initialAuthActionState: AuthActionState = { status: 'idle' }

export type AuthFormAction = (
  state: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>

export type StartGuestTrialState =
  | { readonly status: 'idle' }
  | { readonly status: 'started' }
  | { readonly status: 'account-required' }
  | { readonly status: 'captcha-required' }
  | { readonly status: 'api-error'; readonly error: ApiErrorDetails }

export type StartGuestTrialAction = (
  state: StartGuestTrialState,
  formData: FormData,
) => Promise<StartGuestTrialState>

export const initialStartGuestTrialState: StartGuestTrialState = { status: 'idle' }
