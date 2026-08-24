import { z } from 'zod'

import { apiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import { writeSessionCookies } from '@/lib/auth/session'

import type { SignInActionState } from './types'

const credentialsSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(12).max(64),
})

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

function fieldValue(formData: FormData, field: string): string {
  const value = formData.get(field)

  return typeof value === 'string' ? value : ''
}

function validationMessageKey(
  formData: FormData,
): 'errors.invalidEmail' | 'errors.invalidPassword' | undefined {
  const validation = credentialsSchema.safeParse({
    email: fieldValue(formData, 'email'),
    password: fieldValue(formData, 'password'),
  })

  if (validation.success) return undefined

  return validation.error.issues[0]?.path[0] === 'email'
    ? 'errors.invalidEmail'
    : 'errors.invalidPassword'
}

export function createSignInAction({
  cookieStore,
  fetcher,
  redirect: navigate,
}: SignInActionDependencies) {
  return async function signInAction(
    _previousState: SignInActionState,
    formData: FormData,
  ): Promise<SignInActionState> {
    const invalidMessageKey = validationMessageKey(formData)

    if (invalidMessageKey !== undefined) {
      return { status: 'error', messageKey: invalidMessageKey }
    }

    let session: z.infer<typeof signInResponseSchema>

    try {
      session = await apiFetch('/auth/sign-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: fieldValue(formData, 'email'),
          password: fieldValue(formData, 'password'),
          captchaToken: fieldValue(formData, 'captchaToken'),
        }),
        cookieStore,
        fetcher,
        schema: signInResponseSchema,
      })
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }

    writeSessionCookies(cookieStore, session)
    return navigate('/practice')
  }
}
