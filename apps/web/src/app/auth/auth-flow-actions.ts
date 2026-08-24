import { z } from 'zod'

import { apiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import { clearSessionCookies, readSessionCookies } from '@/lib/auth/session'

import type { AuthActionState } from './auth-action-state'
import { captchaTokenSchema, emailSchema } from './auth-credentials'
import { formFieldValue } from './form-validation'
import { passwordSchema } from './password-policy'

const messageSchema = z.object({ message: z.string() })

type CookieStore = Parameters<typeof clearSessionCookies>[0]
type EmailRequestPath = '/auth/email/resend' | '/auth/password/recovery'

type CommonDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

export function createEmailRequestAction({
  path,
  cookieStore,
  fetcher,
}: CommonDependencies & { readonly path: EmailRequestPath }) {
  return async function emailRequestAction(
    _previousState: AuthActionState,
    formData: FormData,
  ): Promise<AuthActionState> {
    const captchaToken = formFieldValue(formData, 'captchaToken')
    const email = formFieldValue(formData, 'email')

    if (!captchaTokenSchema.safeParse(captchaToken).success) {
      return { status: 'validation-error', messageKey: 'errors.captchaRequired' }
    }

    if (!emailSchema.safeParse(email).success) {
      return { status: 'validation-error', messageKey: 'errors.invalidEmail' }
    }

    try {
      await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, captchaToken }),
        cookieStore,
        fetcher,
        schema: messageSchema,
      })

      return { status: 'success' }
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }
  }
}

export function createUpdatePasswordAction({
  cookieStore,
  fetcher,
  redirect,
}: CommonDependencies & { readonly redirect: (path: string) => never }) {
  return async function updatePasswordAction(
    _previousState: AuthActionState,
    formData: FormData,
  ): Promise<AuthActionState> {
    const password = passwordSchema.safeParse(formFieldValue(formData, 'password'))

    if (!password.success) {
      return { status: 'validation-error', messageKey: 'errors.invalidPassword' }
    }

    try {
      await apiFetch('/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.data }),
        cookieStore,
        fetcher,
        schema: messageSchema,
      })
    } catch (error: unknown) {
      return { status: 'api-error', error: apiErrorDetails(error) }
    }

    clearSessionCookies(cookieStore)

    return redirect('/auth/sign-in?status=password-updated')
  }
}

export function createSignOutAction({
  cookieStore,
  fetcher,
  redirect,
}: CommonDependencies & { readonly redirect: (path: string) => never }) {
  return async function signOutAction(): Promise<never> {
    const { accessToken } = readSessionCookies(cookieStore)
    try {
      if (accessToken !== undefined) {
        await apiFetch('/auth/sign-out', {
          method: 'POST',
          cookieStore,
          fetcher,
          schema: messageSchema,
        })
      }
    } finally {
      clearSessionCookies(cookieStore)
    }
    return redirect('/auth/sign-in')
  }
}
