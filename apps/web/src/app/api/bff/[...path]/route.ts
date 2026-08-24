import { cookies } from 'next/headers'
import { z } from 'zod'

import { clearSessionCookies, readSessionCookies, writeSessionCookies } from '@/lib/auth/session'

const refreshResponseSchema = z.object({
  data: z.object({
    accessToken: z.string(),
    expiresAt: z.string(),
    refreshToken: z.string(),
  }),
})

type CookieStore = Parameters<typeof writeSessionCookies>[0]
type Fetcher = typeof fetch
type BffRouteContext = { params: Promise<{ path: string[] }> }
type BffRouteHandler = (request: Request, context: BffRouteContext) => Promise<Response>

type BffRouteHandlerDependencies = {
  readonly apiBaseUrl: string
  readonly cookieStore: CookieStore
  readonly fetcher: Fetcher
}

function errorResponse(status: number, code: string): Response {
  return Response.json(
    {
      error: {
        code,
        issues: null,
        message: 'The request could not be completed.',
        requestId: crypto.randomUUID(),
      },
    },
    { status },
  )
}

function createApiUrl(apiBaseUrl: string, path: string[], requestUrl: string): string {
  const targetUrl = new URL(`/${path.join('/')}`, apiBaseUrl)
  const sourceUrl = new URL(requestUrl)

  targetUrl.search = sourceUrl.search

  return targetUrl.toString()
}

function createHeaders(request: Request, accessToken: string | undefined): Headers {
  const headers = new Headers(request.headers)

  headers.delete('authorization')
  headers.delete('cookie')
  headers.delete('host')
  if (accessToken !== undefined) headers.set('authorization', `Bearer ${accessToken}`)

  return headers
}

function requestBody(method: string, body: ArrayBuffer): ArrayBuffer | undefined {
  return method === 'GET' || method === 'HEAD' ? undefined : body
}

async function refreshSession(
  apiBaseUrl: string,
  cookieStore: CookieStore,
  fetcher: Fetcher,
  refreshToken: string | undefined,
): Promise<string | undefined> {
  if (refreshToken === undefined) return undefined

  const response = await fetcher(new URL('/auth/refresh', apiBaseUrl), {
    body: JSON.stringify({ refreshToken }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  })

  if (!response.ok) return undefined

  const body: unknown = await response.json()
  const parsed = refreshResponseSchema.safeParse(body)

  if (!parsed.success) return undefined

  writeSessionCookies(cookieStore, parsed.data.data)

  return parsed.data.data.accessToken
}

export function createBffRouteHandler({
  apiBaseUrl,
  cookieStore,
  fetcher,
}: BffRouteHandlerDependencies): BffRouteHandler {
  return async (request, { params }) => {
    const { path } = await params
    const { accessToken, refreshToken } = readSessionCookies(cookieStore)
    const body = await request.arrayBuffer()
    const apiUrl = createApiUrl(apiBaseUrl, path, request.url)

    const forwardRequest = (token: string | undefined): Promise<Response> => {
      const headers = createHeaders(request, token)
      const forwardedBody = requestBody(request.method, body)

      return forwardedBody === undefined
        ? fetcher(apiUrl, { headers, method: request.method })
        : fetcher(apiUrl, { body: forwardedBody, headers, method: request.method })
    }

    const response = await forwardRequest(accessToken)

    if (response.status !== 401) return response

    const refreshedAccessToken = await refreshSession(
      apiBaseUrl,
      cookieStore,
      fetcher,
      refreshToken,
    )

    if (refreshedAccessToken === undefined) {
      clearSessionCookies(cookieStore)

      return errorResponse(401, 'web.AUTHENTICATION_EXPIRED')
    }

    return forwardRequest(refreshedAccessToken)
  }
}

async function handle(request: Request, context: BffRouteContext): Promise<Response> {
  const apiBaseUrl = process.env.API_BASE_URL

  if (apiBaseUrl === undefined) return errorResponse(500, 'web.API_BASE_URL_MISSING')

  const cookieStore = await cookies()

  return createBffRouteHandler({ apiBaseUrl, cookieStore, fetcher: fetch })(request, context)
}

export const DELETE = handle
export const GET = handle
export const HEAD = handle
export const PATCH = handle
export const POST = handle
export const PUT = handle
