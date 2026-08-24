import { z } from 'zod'

import { apiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import { provisionAccount } from '@/lib/auth/provision-account'
import { REDIRECT_FIELD_NAME, safeRedirectPath } from '@/lib/auth/redirect-target'
import { writeSessionCookies } from '@/lib/auth/session'

import type { AuthActionState } from '../auth-action-state'
import { credentialsMessageKey, signInPasswordSchema } from '../auth-credentials'
import { formFieldValue } from '../form-validation'

const signInResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.iso.datetime(),
})

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type SignInActionDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
  readonly redirect: (path: string) => never
}

export function createSignInAction({
  cookieStore,
  fetcher,
  redirect: navigate,
}: SignInActionDependencies) {
  return async function signInAction(
    _previousState: AuthActionState,
    formData: FormData,
  ): Promise<AuthActionState> {
    const credentials = {
      captchaToken: formFieldValue(formData, 'captchaToken'),
      email: formFieldValue(formData, 'email'),
      password: formFieldValue(formData, 'password'),
    }
    const invalidMessageKey = credentialsMessageKey(credentials, signInPasswordSchema)

    if (invalidMessageKey !== undefined) {
      return { status: 'validation-error', messageKey: invalidMessageKey }
    }

    let session: z.infer<typeof signInResponseSchema>

    try {
      session = await apiFetch('/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        cookieStore,
        fetcher,
        schema: signInResponseSchema,
      })
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }

    writeSessionCookies(cookieStore, session)

    const provisionError = await provisionAccount({ cookieStore, fetcher })

    if (provisionError !== null) return { status: 'api-error', error: provisionError }

    return navigate(safeRedirectPath(formFieldValue(formData, REDIRECT_FIELD_NAME)))
  }
}
