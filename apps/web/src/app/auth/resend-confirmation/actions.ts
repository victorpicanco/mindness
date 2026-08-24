'use server'

import { cookies } from 'next/headers'

import type { AuthActionState } from '../auth-action-state'
import { createEmailRequestAction } from '../auth-flow-actions'

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
