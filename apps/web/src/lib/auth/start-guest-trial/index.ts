'use server'

import { cookies } from 'next/headers'

import type { StartGuestTrialState } from '@/lib/auth/action-state'
import { createStartGuestTrialAction } from '@/lib/auth/server-actions'

export async function startGuestTrialAction(
  state: StartGuestTrialState,
  formData: FormData,
): Promise<StartGuestTrialState> {
  return createStartGuestTrialAction({ cookieStore: await cookies(), fetcher: fetch })(
    state,
    formData,
  )
}
