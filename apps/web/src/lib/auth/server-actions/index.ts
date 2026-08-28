import { z } from 'zod'

import { apiErrorDetails } from '@/lib/api/api-error'
import { apiFetch } from '@/lib/api/server-client'
import { provisionAccount } from '@/lib/auth/provision-account'
import { REDIRECT_FIELD_NAME, safeRedirectPath } from '@/lib/auth/redirect-target'
import {
  clearSessionCookies,
  readSessionCookies,
  type SessionCookieStore,
  writeSessionCookies,
} from '@/lib/auth/session'

import type { AuthActionState } from '@/lib/auth/action-state'
import {
  captchaTokenSchema,
  credentialsMessageKey,
  emailSchema,
  signInPasswordSchema,
} from '@/lib/auth/credentials'
import { formFieldValue } from '@/lib/auth/form-validation'
import { passwordSchema } from '@/lib/auth/password-policy'

const messageSchema = z.object({ message: z.string() })
const signInResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.iso.datetime(),
})

type CookieStore = SessionCookieStore
type EmailRequestPath = '/auth/email/resend' | '/auth/password/recovery'

type CommonDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

export function createSignInAction({
  cookieStore,
  fetcher,
  redirect: navigate,
}: CommonDependencies & { readonly redirect: (path: string) => never }) {
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

export function createSignUpAction({ cookieStore, fetcher }: CommonDependencies) {
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

    if (formFieldValue(formData, 'passwordConfirmation') !== credentials.password) {
      return { status: 'validation-error', messageKey: 'errors.passwordMismatch' }
    }

    try {
      await apiFetch('/auth/sign-up', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials),
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
