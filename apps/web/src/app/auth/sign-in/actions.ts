'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createSignInAction } from './sign-in-action-factory'
import type { SignInActionState } from './types'

export async function signInAction(
  previousState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const cookieStore = await cookies()

  return createSignInAction({ cookieStore, fetcher: fetch, redirect })(previousState, formData)
}
