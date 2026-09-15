'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { AuthActionState } from '@/lib/auth/action-state'
import { createSignInAction, createSignUpAction } from '@/lib/auth/server-actions'

export async function signInAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const cookieStore = await cookies()

  return createSignInAction({ cookieStore, fetcher: fetch, redirect })(previousState, formData)
}

export async function signUpAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const cookieStore = await cookies()

  return createSignUpAction({ cookieStore, fetcher: fetch })(previousState, formData)
}
