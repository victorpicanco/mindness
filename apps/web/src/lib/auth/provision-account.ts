import { z } from 'zod'

import { apiErrorDetails, type ApiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'

import { clearSessionCookies } from './session'

const provisionAccountResponseSchema = z.object({ message: z.string() })
const accountProfileResponseSchema = z.object({ accountId: z.string() })

type CookieStore = Parameters<typeof clearSessionCookies>[0]

type ProvisionAccountDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

export async function provisionAccount({
  cookieStore,
  fetcher,
}: ProvisionAccountDependencies): Promise<ApiErrorDetails | null> {
  try {
    await apiFetch('/accounts/me', {
      method: 'GET',
      cookieStore,
      fetcher,
      schema: accountProfileResponseSchema,
    })

    return null
  } catch (error: unknown) {
    const details = apiErrorDetails(error)

    if (details.code !== 'accounts.ACCOUNT_NOT_FOUND') {
      clearSessionCookies(cookieStore)
      return details
    }
  }

  try {
    await apiFetch('/accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeZone: null }),
      cookieStore,
      fetcher,
      schema: provisionAccountResponseSchema,
    })

    return null
  } catch (error: unknown) {
    clearSessionCookies(cookieStore)

    return apiErrorDetails(error)
  }
}
