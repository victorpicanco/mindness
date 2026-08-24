import { z } from 'zod'

import { apiErrorDetails, type ApiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import type { writeSessionCookies } from '@/lib/auth/session'

const acceptConsentResponseSchema = z.object({
  purpose: z.literal('voice_recording_and_analysis'),
  version: z.string(),
  acceptedAt: z.string().datetime(),
})

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type AcceptConsentDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

export async function acceptConsent({
  cookieStore,
  fetcher,
}: AcceptConsentDependencies): Promise<ApiErrorDetails | null> {
  try {
    await apiFetch('/accounts/me/consent', {
      method: 'POST',
      cookieStore,
      fetcher,
      schema: acceptConsentResponseSchema,
    })

    return null
  } catch (error: unknown) {
    return apiErrorDetails(error)
  }
}
