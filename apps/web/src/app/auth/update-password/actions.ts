'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { AuthActionState } from '../auth-action-state'
import { createUpdatePasswordAction } from '../auth-flow-actions'

export async function updatePasswordAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return createUpdatePasswordAction({ cookieStore: await cookies(), fetcher: fetch, redirect })(
    previousState,
    formData,
  )
}
