import { z } from 'zod'

import type { AuthActionMessageKey } from '../form-validation'
import { passwordSchema } from '../password-policy'
import { apiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import type { writeSessionCookies } from '@/lib/auth/session'

import { type SignUpActionState } from './types'

const credentialsSchema = z.object({
  captchaToken: z.string().min(1),
  email: z.email().max(254),
  password: passwordSchema,
})

const signUpResponseSchema = z.object({ message: z.string() })

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type SignUpActionDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

function fieldValue(formData: FormData, field: string): string {
  const value = formData.get(field)

  return typeof value === 'string' ? value : ''
}

function validationMessageKey(formData: FormData): AuthActionMessageKey | undefined {
  const validation = credentialsSchema.safeParse({
    captchaToken: fieldValue(formData, 'captchaToken'),
    email: fieldValue(formData, 'email'),
    password: fieldValue(formData, 'password'),
  })

  if (validation.success) return undefined

  const field = validation.error.issues[0]?.path[0]

  if (field === 'captchaToken') return 'errors.captchaRequired'
  return field === 'email' ? 'errors.invalidEmail' : 'errors.invalidPassword'
}

export function createSignUpAction({ cookieStore, fetcher }: SignUpActionDependencies) {
  return async function signUpAction(
    _previousState: SignUpActionState,
    formData: FormData,
  ): Promise<SignUpActionState> {
    const invalidMessageKey = validationMessageKey(formData)

    if (invalidMessageKey !== undefined) {
      return { status: 'validation-error', messageKey: invalidMessageKey }
    }

    try {
      await apiFetch('/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fieldValue(formData, 'email'),
          password: fieldValue(formData, 'password'),
          captchaToken: fieldValue(formData, 'captchaToken'),
        }),
        cookieStore,
        fetcher,
        schema: signUpResponseSchema,
      })

      return { status: 'success', messageKey: 'signUp.success' }
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }
  }
}
