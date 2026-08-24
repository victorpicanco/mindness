'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { createUpdatePasswordAction } from '../auth-flow-actions'

export async function updatePasswordAction(
  _state: { readonly status: 'idle' | 'error' },
  formData: FormData,
): Promise<{ readonly status: 'idle' | 'error' }> {
  return createUpdatePasswordAction({ cookieStore: await cookies(), fetcher: fetch, redirect })(
    formData,
  )
}
