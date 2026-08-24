import { z } from 'zod'

import { apiFetch } from '@/lib/api/server-client'
import { clearSessionCookies, readSessionCookies } from '@/lib/auth/session'

const messageSchema = z.object({ message: z.string() })
const emailRequestSchema = z.object({
  email: z.email().max(254),
  captchaToken: z.string().min(1),
})
const passwordSchema = z.string().min(8).max(64)

type CookieStore = Parameters<typeof clearSessionCookies>[0]
type EmailRequestPath = '/auth/email/resend' | '/auth/password/recovery'
export type EmailRequestState = { readonly status: 'idle' | 'success' | 'error' }

type CommonDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

function fieldValue(formData: FormData, name: string): string {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

export function createEmailRequestAction({
  path,
  cookieStore,
  fetcher,
}: CommonDependencies & { readonly path: EmailRequestPath }) {
  return async function emailRequestAction(
    formData: FormData,
  ): Promise<{ readonly status: 'success' | 'error' }> {
    const input = emailRequestSchema.safeParse({
      email: fieldValue(formData, 'email'),
      captchaToken: fieldValue(formData, 'captchaToken'),
    })
    if (!input.success) return { status: 'error' }

    try {
      await apiFetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input.data),
        cookieStore,
        fetcher,
        schema: messageSchema,
      })
      return { status: 'success' }
    } catch {
      return { status: 'error' }
    }
  }
}

export function createUpdatePasswordAction({
  cookieStore,
  fetcher,
  redirect,
}: CommonDependencies & { readonly redirect: (path: string) => never }) {
  return async function updatePasswordAction(formData: FormData) {
    const password = passwordSchema.safeParse(fieldValue(formData, 'password'))
    if (!password.success) return { status: 'error' as const }

    try {
      await apiFetch('/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: password.data }),
        cookieStore,
        fetcher,
        schema: messageSchema,
      })
    } catch {
      return { status: 'error' as const }
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
