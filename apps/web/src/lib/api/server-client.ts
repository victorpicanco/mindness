import 'server-only' // server-only

import { cookies } from 'next/headers'
import type { z } from 'zod'

import { ApiClientError } from '@/lib/api/client-error'
import { errorEnvelopeSchema, successEnvelopeSchema } from '@/lib/api/contracts/envelopes'
import { requestRefreshedTokens } from '@/lib/auth/renew-session'
import { EnvironmentError } from '@/lib/env/errors'
import { readServerEnv } from '@/lib/env/server'
import { clearSessionCookies, readSessionCookies, writeSessionCookies } from '@/lib/auth/session'

type CookieStore = Parameters<typeof writeSessionCookies>[0]
type Fetcher = typeof fetch

type ApiFetchOptions<TSchema extends z.ZodType> = Omit<RequestInit, 'headers'> & {
  readonly cookieStore?: CookieStore
  readonly fetcher?: Fetcher
  readonly headers?: HeadersInit
  readonly schema: TSchema
}

function apiUrl(path: string): string {
  return new URL(path, readServerEnv().API_BASE_URL).toString()
}

function withAuthorization(
  headers: HeadersInit | undefined,
  accessToken: string | undefined,
): Headers {
  const authorizedHeaders = new Headers(headers)

  if (accessToken !== undefined) {
    authorizedHeaders.set('Authorization', `Bearer ${accessToken}`)
  }

  return authorizedHeaders
}

function requestApi(
  fetcher: Fetcher,
  path: string,
  init: RequestInit,
  accessToken: string | undefined,
): Promise<Response> {
  return fetcher(apiUrl(path), {
    ...init,
    headers: withAuthorization(init.headers, accessToken),
  })
}

async function refreshAndRetry(
  path: string,
  store: CookieStore,
  fetcher: Fetcher,
  init: RequestInit,
  refreshToken: string,
): Promise<Response | null> {
  if (path === '/auth/refresh') return null

  const tokens = await requestRefreshedTokens({
    endpoint: apiUrl('/auth/refresh'),
    fetcher,
    refreshToken,
  })

  if (tokens === null) {
    clearSessionCookies(store)
    return null
  }

  writeSessionCookies(store, tokens)

  return requestApi(fetcher, path, init, tokens.accessToken)
}

export async function apiFetch<TSchema extends z.ZodType>(
  path: string,
  { cookieStore, fetcher = fetch, headers, schema, ...init }: ApiFetchOptions<TSchema>,
): Promise<z.output<TSchema>> {
  const store = cookieStore ?? (await cookies())
  const { accessToken, refreshToken } = readSessionCookies(store)
  let response: Response
  const requestInit: RequestInit = headers === undefined ? init : { ...init, headers }

  try {
    response = await requestApi(fetcher, path, requestInit, accessToken)
    if (response.status === 401 && refreshToken !== undefined) {
      response =
        (await refreshAndRetry(path, store, fetcher, requestInit, refreshToken)) ?? response
    }
  } catch (cause: unknown) {
    if (cause instanceof EnvironmentError) throw cause

    throw new ApiClientError({
      code: 'web.API_REQUEST_FAILED',
      message: 'Unable to reach the API.',
      issues: null,
      requestId: null,
      cause,
    })
  }

  let body: unknown

  try {
    body = await response.json()
  } catch (cause: unknown) {
    throw new ApiClientError({
      code: 'web.API_RESPONSE_INVALID',
      message: 'The API returned an invalid response.',
      issues: null,
      requestId: null,
      cause,
    })
  }

  try {
    if (!response.ok) {
      const { error } = errorEnvelopeSchema.parse(body)

      throw new ApiClientError({ ...error, requestId: error.requestId })
    }

    const { data } = successEnvelopeSchema.parse(body)

    return schema.parse(data)
  } catch (cause: unknown) {
    if (cause instanceof ApiClientError) throw cause

    throw new ApiClientError({
      code: 'web.API_RESPONSE_INVALID',
      message: 'The API returned an invalid response.',
      issues: null,
      requestId: null,
      cause,
    })
  }
}
