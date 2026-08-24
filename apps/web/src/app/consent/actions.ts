'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'

import type { ApiErrorDetails } from '@/lib/api/api-error'
import { apiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import type { writeSessionCookies } from '@/lib/auth/session'

const acceptConsentResponseSchema = z.object({
  purpose: z.literal('voice_recording_and_analysis'),
  version: z.string(),
  acceptedAt: z.string().datetime(),
})

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type AcceptConsentActionDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

export type ConsentActionState =
  | { readonly status: 'idle'; readonly message: null }
  | { readonly status: 'success'; readonly messageKey: 'messages.consentRecorded' }
  | { readonly status: 'api-error'; readonly error: ApiErrorDetails }

export const initialConsentActionState: ConsentActionState = { status: 'idle', message: null }

export function createAcceptConsentAction({
  cookieStore,
  fetcher,
}: AcceptConsentActionDependencies) {
  return async function acceptConsentAction(
    previousState: ConsentActionState,
    formData: FormData,
  ): Promise<ConsentActionState> {
    void previousState
    void formData

    try {
      await apiFetch('/accounts/me/consent', {
        method: 'POST',
        cookieStore,
        fetcher,
        schema: acceptConsentResponseSchema,
      })

      return { status: 'success', messageKey: 'messages.consentRecorded' }
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }
  }
}

export async function acceptConsentAction(
  previousState: ConsentActionState,
  formData: FormData,
): Promise<ConsentActionState> {
  const cookieStore = await cookies()

  return createAcceptConsentAction({ cookieStore, fetcher: fetch })(previousState, formData)
}
