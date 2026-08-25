'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import type { AuthActionState } from '@/lib/auth/action-state'
import { createUpdatePasswordAction } from '@/lib/auth/server-actions'

export async function updatePasswordAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return createUpdatePasswordAction({ cookieStore: await cookies(), fetcher: fetch, redirect })(
    previousState,
    formData,
  )
}
