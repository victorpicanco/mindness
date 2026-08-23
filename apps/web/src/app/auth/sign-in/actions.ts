'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { ApiClientError, apiFetch } from '@/lib/api/server-client'
import { writeSessionCookies } from '@/lib/auth/session'

const credentialsSchema = z.object({
  email: z.string().email({ message: 'Informe um e-mail válido.' }).max(254),
  password: z
    .string()
    .min(12, {
      message:
        'Use uma senha de 12 a 64 caracteres com letras maiúsculas e minúsculas, número e símbolo.',
    })
    .max(64, {
      message:
        'Use uma senha de 12 a 64 caracteres com letras maiúsculas e minúsculas, número e símbolo.',
    }),
})

const signInResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.string().datetime(),
})

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type SignInActionDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
  readonly redirect: (path: string) => never
}

export type SignInActionState =
  | { readonly status: 'idle'; readonly message: null }
  | { readonly status: 'error'; readonly message: string }

export const initialSignInActionState: SignInActionState = { status: 'idle', message: null }

function fieldValue(formData: FormData, field: string): string {
  const value = formData.get(field)

  return typeof value === 'string' ? value : ''
}

function validationMessage(formData: FormData): string | undefined {
  const validation = credentialsSchema.safeParse({
    email: fieldValue(formData, 'email'),
    password: fieldValue(formData, 'password'),
  })

  return validation.success ? undefined : validation.error.issues[0]?.message
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError && error.code === 'accounts.AUTHENTICATION_REJECTED') {
    return 'E-mail ou senha incorretos.'
  }

  if (error instanceof ApiClientError) {
    return error.message
  }

  return 'Não foi possível entrar. Tente novamente.'
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
    const invalidMessage = validationMessage(formData)

    if (invalidMessage !== undefined) {
      return { status: 'error', message: invalidMessage }
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
      return { status: 'error', message: errorMessage(error) }
    }

    writeSessionCookies(cookieStore, session)
    return navigate('/practice')
  }
}

export async function signInAction(
  previousState: SignInActionState,
  formData: FormData,
): Promise<SignInActionState> {
  const cookieStore = await cookies()

  return createSignInAction({ cookieStore, fetcher: fetch, redirect })(previousState, formData)
}
