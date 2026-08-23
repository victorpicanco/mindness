'use server'

import { cookies } from 'next/headers'
import { z } from 'zod'

import { ApiClientError, apiFetch } from '@/lib/api/server-client'
import type { writeSessionCookies } from '@/lib/auth/session'

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

const signUpResponseSchema = z.object({ message: z.string() })

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type SignUpActionDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

export type SignUpActionState =
  | { readonly status: 'idle'; readonly message: null }
  | { readonly status: 'success'; readonly message: string }
  | { readonly status: 'error'; readonly message: string }

export const initialSignUpActionState: SignUpActionState = { status: 'idle', message: null }

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
  if (error instanceof ApiClientError) {
    if (error.code === 'accounts.ACCOUNT_CREATION_REJECTED') {
      return 'Verifique seu e-mail para continuar, caso exista uma conta elegível para este endereço.'
    }

    return error.message
  }

  return 'Não foi possível criar sua conta. Tente novamente.'
}

export function createSignUpAction({ cookieStore, fetcher }: SignUpActionDependencies) {
  return async function signUpAction(
    _previousState: SignUpActionState,
    formData: FormData,
  ): Promise<SignUpActionState> {
    const invalidMessage = validationMessage(formData)

    if (invalidMessage !== undefined) {
      return { status: 'error', message: invalidMessage }
    }

    try {
      const response = await apiFetch('/auth/sign-up', {
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

      return { status: 'success', message: response.message }
    } catch (error: unknown) {
      return { status: 'error', message: errorMessage(error) }
    }
  }
}

export async function signUpAction(
  previousState: SignUpActionState,
  formData: FormData,
): Promise<SignUpActionState> {
  const cookieStore = await cookies()

  return createSignUpAction({ cookieStore, fetcher: fetch })(previousState, formData)
}
