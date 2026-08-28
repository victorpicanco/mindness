'use server'

import { cookies } from 'next/headers'

import type { AuthActionState } from '@/lib/auth/action-state'

import { createSignUpAction } from '@/lib/auth/server-actions'

export async function signUpAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const cookieStore = await cookies()

  return createSignUpAction({ cookieStore, fetcher: fetch })(previousState, formData)
}
