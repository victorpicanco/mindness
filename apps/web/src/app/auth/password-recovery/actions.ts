'use server'

import { cookies } from 'next/headers'

import type { AuthActionState } from '../auth-action-state'
import { createEmailRequestAction } from '../auth-flow-actions'

export async function requestPasswordRecoveryAction(
  previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  return createEmailRequestAction({
    path: '/auth/password/recovery',
    cookieStore: await cookies(),
    fetcher: fetch,
  })(previousState, formData)
}
