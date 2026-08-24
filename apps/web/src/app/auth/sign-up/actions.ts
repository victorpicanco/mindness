'use server'

import { cookies } from 'next/headers'

import type { AuthActionState } from '../auth-action-state'

import { createSignUpAction } from './sign-up-action-factory'

export async function signUpAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const cookieStore = await cookies()

  return createSignUpAction({ cookieStore, fetcher: fetch })(previousState, formData)
}
