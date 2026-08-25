import { z } from 'zod'

import { apiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import type { writeSessionCookies } from '@/lib/auth/session'

import type { AuthActionState } from '@/lib/auth/action-state'
import { credentialsMessageKey } from '@/lib/auth/credentials'
import { formFieldValue } from '@/lib/auth/form-validation'
import { passwordSchema } from '@/lib/auth/password-policy'

const signUpResponseSchema = z.object({ message: z.string() })

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type SignUpActionDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

export function createSignUpAction({ cookieStore, fetcher }: SignUpActionDependencies) {
  return async function signUpAction(
    _previousState: AuthActionState,
    formData: FormData,
  ): Promise<AuthActionState> {
    const credentials = {
      captchaToken: formFieldValue(formData, 'captchaToken'),
      email: formFieldValue(formData, 'email'),
      password: formFieldValue(formData, 'password'),
    }
    const invalidMessageKey = credentialsMessageKey(credentials, passwordSchema)

    if (invalidMessageKey !== undefined) {
      return { status: 'validation-error', messageKey: invalidMessageKey }
    }

    try {
      await apiFetch('/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
        cookieStore,
        fetcher,
        schema: signUpResponseSchema,
      })

      return { status: 'success' }
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }
  }
}
