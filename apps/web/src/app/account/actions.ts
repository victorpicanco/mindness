'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { ApiClientError, apiFetch } from '@/lib/api/server-client'
import { clearSessionCookies, type writeSessionCookies } from '@/lib/auth/session'

const updateTimeZoneResponseSchema = z.object({ timeZone: z.string() })
const deleteAccountResponseSchema = z.object({ scheduledFor: z.string().datetime() })

type CookieStore = Parameters<typeof writeSessionCookies>[0]

type AccountActionsDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
  readonly redirect: (path: string) => never
}

export type UpdateTimeZoneActionState =
  | { readonly status: 'idle'; readonly message: null }
  | { readonly status: 'success'; readonly message: string }
  | { readonly status: 'error'; readonly message: string }

export type DeleteAccountActionState =
  | { readonly status: 'idle'; readonly message: null }
  | { readonly status: 'error'; readonly message: string }

export const initialUpdateTimeZoneActionState: UpdateTimeZoneActionState = {
  status: 'idle',
  message: null,
}

export const initialDeleteAccountActionState: DeleteAccountActionState = {
  status: 'idle',
  message: null,
}

function fieldValue(formData: FormData, field: string): string {
  const value = formData.get(field)

  return typeof value === 'string' ? value : ''
}

function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: value })
    return true
  } catch {
    return false
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiClientError ? error.message : fallback
}

export function createAccountActions({
  cookieStore,
  fetcher,
  redirect: navigate,
}: AccountActionsDependencies) {
  return {
    async updateTimeZoneAction(
      _previousState: UpdateTimeZoneActionState,
      formData: FormData,
    ): Promise<UpdateTimeZoneActionState> {
      const timeZone = fieldValue(formData, 'timeZone')

      if (!isIanaTimeZone(timeZone)) {
        return { status: 'error', message: 'Escolha um fuso horário válido.' }
      }

      try {
        await apiFetch('/accounts/me/time-zone', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeZone }),
          cookieStore,
          fetcher,
          schema: updateTimeZoneResponseSchema,
        })

        return { status: 'success', message: 'Fuso horário atualizado.' }
      } catch (error: unknown) {
        return {
          status: 'error',
          message: errorMessage(
            error,
            'Não foi possível atualizar o fuso horário. Tente novamente.',
          ),
        }
      }
    },

    async deleteAccountAction(
      previousState: DeleteAccountActionState,
      formData: FormData,
    ): Promise<DeleteAccountActionState> {
      void previousState
      void formData

      try {
        await apiFetch('/accounts/me', {
          method: 'DELETE',
          cookieStore,
          fetcher,
          schema: deleteAccountResponseSchema,
        })
      } catch (error: unknown) {
        return {
          status: 'error',
          message: errorMessage(error, 'Não foi possível excluir sua conta. Tente novamente.'),
        }
      }

      clearSessionCookies(cookieStore)
      return navigate('/')
    },
  }
}

export async function updateTimeZoneAction(
  previousState: UpdateTimeZoneActionState,
  formData: FormData,
): Promise<UpdateTimeZoneActionState> {
  const cookieStore = await cookies()

  return createAccountActions({ cookieStore, fetcher: fetch, redirect }).updateTimeZoneAction(
    previousState,
    formData,
  )
}

export async function deleteAccountAction(
  previousState: DeleteAccountActionState,
  formData: FormData,
): Promise<DeleteAccountActionState> {
  const cookieStore = await cookies()

  return createAccountActions({ cookieStore, fetcher: fetch, redirect }).deleteAccountAction(
    previousState,
    formData,
  )
}
