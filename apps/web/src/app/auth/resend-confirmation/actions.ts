'use server'

import { cookies } from 'next/headers'

import { createEmailRequestAction, type EmailRequestState } from '../auth-flow-actions'

export async function resendConfirmationAction(
  _state: EmailRequestState,
  formData: FormData,
): Promise<EmailRequestState> {
  return createEmailRequestAction({
    path: '/auth/email/resend',
    cookieStore: await cookies(),
    fetcher: fetch,
  })(formData)
}
