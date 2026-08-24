export type SignUpActionState =
  | { readonly status: 'idle'; readonly message: null }
  | { readonly status: 'success'; readonly message: string }
  | { readonly status: 'error'; readonly message: string }

export const initialSignUpActionState: SignUpActionState = { status: 'idle', message: null }
