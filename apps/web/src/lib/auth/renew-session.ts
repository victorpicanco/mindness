import { z } from 'zod'

import { needsAccessTokenRefresh, readSessionCookies, type SessionTokens } from './session'

const REFRESH_PATH = '/auth/refresh'

const refreshEnvelopeSchema = z.object({
  data: z.object({
    accessToken: z.string().min(1),
    refreshToken: z.string().min(1),
    expiresAt: z.iso.datetime(),
  }),
})

type Fetcher = typeof fetch

type SessionCookieReader = Parameters<typeof needsAccessTokenRefresh>[0]

type RequestRefreshedTokensOptions = {
  readonly endpoint: string
  readonly fetcher: Fetcher
  readonly refreshToken: string
}

type RenewSessionOptions = {
  readonly cookieStore: SessionCookieReader
  readonly fetcher?: Fetcher
  readonly nowInSeconds?: number
}

export type SessionRenewal =
  | { readonly status: 'untouched' }
  | { readonly status: 'renewed'; readonly tokens: SessionTokens }
  | { readonly status: 'ended' }

export async function requestRefreshedTokens({
  endpoint,
  fetcher,
  refreshToken,
}: RequestRefreshedTokensOptions): Promise<SessionTokens | null> {
  const response = await fetcher(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    cache: 'no-store',
  })

  if (!response.ok) return null

  const body: unknown = await response.json()
  const { data } = refreshEnvelopeSchema.parse(body)

  return { accessToken: data.accessToken, refreshToken: data.refreshToken }
}

export async function renewSession({
  cookieStore,
  fetcher = fetch,
  nowInSeconds,
}: RenewSessionOptions): Promise<SessionRenewal> {
  if (!needsAccessTokenRefresh(cookieStore, nowInSeconds)) return { status: 'untouched' }

  const { refreshToken } = readSessionCookies(cookieStore)
  const apiBaseUrl = process.env.API_BASE_URL

  if (refreshToken === undefined || apiBaseUrl === undefined || apiBaseUrl === '') {
    return { status: 'untouched' }
  }

  try {
    const tokens = await requestRefreshedTokens({
      endpoint: new URL(REFRESH_PATH, apiBaseUrl).toString(),
      fetcher,
      refreshToken,
    })

    return tokens === null ? { status: 'ended' } : { status: 'renewed', tokens }
  } catch {
    // A refresh that never produced an answer says nothing about the session.
    // Signing the visitor out here would turn an API blip into a forced
    // sign-out, so the stale cookies are kept and the request fails downstream.
    return { status: 'untouched' }
  }
}
