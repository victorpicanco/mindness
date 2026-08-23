import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { writeSessionCookies } from '@/lib/auth/session'

type CookieStore = Parameters<typeof writeSessionCookies>[0]
type GoogleCallbackRouteHandler = (request: Request) => Promise<Response>

type GoogleCallbackRouteHandlerDependencies = {
  readonly cookieStore: CookieStore
}

function redirect(request: Request, path: string): NextResponse {
  return NextResponse.redirect(new URL(path, request.url), { status: 302 })
}

export function createGoogleCallbackRouteHandler({
  cookieStore,
}: GoogleCallbackRouteHandlerDependencies): GoogleCallbackRouteHandler {
  return (request) => {
    const url = new URL(request.url)
    const accessToken = url.searchParams.get('access_token')
    const refreshToken = url.searchParams.get('refresh_token')

    if (accessToken === null || refreshToken === null) {
      return Promise.resolve(redirect(request, '/auth/sign-in?error=google_callback_failed'))
    }

    writeSessionCookies(cookieStore, { accessToken, refreshToken })

    return Promise.resolve(redirect(request, '/practice'))
  }
}

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies()

  return createGoogleCallbackRouteHandler({ cookieStore })(request)
}
