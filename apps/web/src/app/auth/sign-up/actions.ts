'use server'

import { cookies } from 'next/headers'

import { createSignUpAction } from './sign-up-action-factory'
import { type SignUpActionState } from './types'

export async function signUpAction(
  previousState: SignUpActionState,
  formData: FormData,
): Promise<SignUpActionState> {
  const cookieStore = await cookies()

  return createSignUpAction({ cookieStore, fetcher: fetch })(previousState, formData)
}
