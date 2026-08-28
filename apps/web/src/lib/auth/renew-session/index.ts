import { z } from 'zod'

import { errorEnvelopeSchema } from '@/lib/api/contracts/envelopes'
import { readServerEnv } from '@/lib/env/server'
import { needsAccessTokenRefresh, readSessionCookies, type SessionTokens } from '@/lib/auth/session'

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

type SessionRefreshAttempt =
  | { readonly status: 'renewed'; readonly tokens: SessionTokens }
  | { readonly status: 'rejected' }
  | { readonly status: 'unavailable' }

export async function requestRefreshedTokens({
  endpoint,
  fetcher,
  refreshToken,
}: RequestRefreshedTokensOptions): Promise<SessionRefreshAttempt> {
  let response: Response

  try {
    response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    })
  } catch {
    return { status: 'unavailable' }
  }

  let body: unknown

  try {
    body = await response.json()
  } catch {
    return { status: 'unavailable' }
  }

  if (!response.ok) {
    const parsed = errorEnvelopeSchema.safeParse(body)
    const refreshWasRejected =
      response.status === 401 &&
      parsed.success &&
      parsed.data.error.code === 'accounts.AUTHENTICATION_REJECTED'

    return refreshWasRejected ? { status: 'rejected' } : { status: 'unavailable' }
  }

  const parsed = refreshEnvelopeSchema.safeParse(body)
  if (!parsed.success) return { status: 'unavailable' }

  return {
    status: 'renewed',
    tokens: {
      accessToken: parsed.data.data.accessToken,
      refreshToken: parsed.data.data.refreshToken,
    },
  }
}

export async function renewSession({
  cookieStore,
  fetcher = fetch,
  nowInSeconds,
}: RenewSessionOptions): Promise<SessionRenewal> {
  if (!needsAccessTokenRefresh(cookieStore, nowInSeconds)) return { status: 'untouched' }

  const { refreshToken } = readSessionCookies(cookieStore)

  if (refreshToken === undefined) return { status: 'untouched' }

  try {
    const attempt = await requestRefreshedTokens({
      endpoint: new URL(REFRESH_PATH, readServerEnv().API_BASE_URL).toString(),
      fetcher,
      refreshToken,
    })

    if (attempt.status === 'renewed') return attempt
    if (attempt.status === 'rejected') return { status: 'ended' }

    return { status: 'untouched' }
  } catch {
    // A refresh that never produced an answer says nothing about the session.
    // Signing the visitor out here would turn an API blip into a forced
    // sign-out, so the stale cookies are kept and the request fails downstream.
    return { status: 'untouched' }
  }
}
