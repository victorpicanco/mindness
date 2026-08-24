'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { AuthActionState } from '../auth-action-state'

import { createSignInAction } from './sign-in-action-factory'

export async function signInAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const cookieStore = await cookies()

  return createSignInAction({ cookieStore, fetcher: fetch, redirect })(previousState, formData)
}
