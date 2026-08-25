'use server'

import { cookies } from 'next/headers'

import type { AuthActionState } from '@/lib/auth/action-state'
import { createEmailRequestAction } from '@/lib/auth/server-actions'

export async function resendConfirmationAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return createEmailRequestAction({
    path: '/auth/email/resend',
    cookieStore: await cookies(),
    fetcher: fetch,
  })(previousState, formData)
}
