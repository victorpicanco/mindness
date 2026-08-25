import { cookies } from 'next/headers'
import { clearSessionCookies, readSessionCookies, writeSessionCookies } from '@/lib/auth/session'
import { requestRefreshedTokens } from '@/lib/auth/renew-session'
import { EnvironmentError } from '@/lib/env/errors'
import { readServerEnv } from '@/lib/env/server'

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

    if (refreshToken === undefined) {
      clearSessionCookies(cookieStore)
      return errorResponse(401, 'web.AUTHENTICATION_EXPIRED')
    }

    const attempt = await requestRefreshedTokens({
      endpoint: new URL('/auth/refresh', apiBaseUrl).toString(),
      fetcher,
      refreshToken,
    })

    if (attempt.status === 'unavailable') {
      return errorResponse(503, 'web.AUTHENTICATION_UNAVAILABLE')
    }

    if (attempt.status === 'rejected') {
      clearSessionCookies(cookieStore)
      return errorResponse(401, 'web.AUTHENTICATION_EXPIRED')
    }

    writeSessionCookies(cookieStore, attempt.tokens)

    return forwardRequest(attempt.tokens.accessToken)
  }
}

async function handle(request: Request, context: BffRouteContext): Promise<Response> {
  let apiBaseUrl: string

  try {
    apiBaseUrl = readServerEnv().API_BASE_URL
  } catch (cause: unknown) {
    if (!(cause instanceof EnvironmentError)) throw cause

    return errorResponse(500, cause.code)
  }

  const cookieStore = await cookies()

  return createBffRouteHandler({ apiBaseUrl, cookieStore, fetcher: fetch })(request, context)
}

export const DELETE = handle
export const GET = handle
export const HEAD = handle
export const PATCH = handle
export const POST = handle
export const PUT = handle
