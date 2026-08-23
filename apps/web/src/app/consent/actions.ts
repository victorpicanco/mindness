'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'

import { ApiClientError, apiFetch } from '@/lib/api/server-client'
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
  | { readonly status: 'success'; readonly message: string }
  | { readonly status: 'error'; readonly message: string }

export const initialConsentActionState: ConsentActionState = { status: 'idle', message: null }

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message
  }

  return 'Não foi possível registrar seu consentimento. Tente novamente.'
}

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

      return { status: 'success', message: 'Consentimento registrado.' }
    } catch (error: unknown) {
      return { status: 'error', message: errorMessage(error) }
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
