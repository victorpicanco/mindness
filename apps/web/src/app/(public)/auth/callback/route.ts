import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { provisionAccount } from '@/lib/auth/provision-account'
import { SIGNED_IN_HOME } from '@/lib/auth/redirect-target'
import { writeSessionCookies } from '@/lib/auth/session'

type CookieStore = Parameters<typeof writeSessionCookies>[0]
type GoogleCallbackRouteHandler = (request: Request) => Promise<Response>

type GoogleCallbackRouteHandlerDependencies = {
  readonly cookieStore: CookieStore
  readonly fetcher: typeof fetch
}

const GOOGLE_CALLBACK_FAILED = 'google_callback_failed'
function redirect(path: string): NextResponse {
  return new NextResponse(null, { status: 302, headers: { location: path } })
}

function signInWithError(code: string): NextResponse {
  return redirect(`/auth/sign-in?error=${encodeURIComponent(code)}`)
}

export function createGoogleCallbackRouteHandler({
  cookieStore,
  fetcher,
}: GoogleCallbackRouteHandlerDependencies): GoogleCallbackRouteHandler {
  return async (request) => {
    const url = new URL(request.url)
    const accessToken = url.searchParams.get('access_token')
    const refreshToken = url.searchParams.get('refresh_token')

    if (accessToken === null || refreshToken === null) {
      return signInWithError(GOOGLE_CALLBACK_FAILED)
    }

    writeSessionCookies(cookieStore, { accessToken, refreshToken })

    const provisionError = await provisionAccount({ cookieStore, fetcher })

    if (provisionError !== null) return signInWithError(provisionError.code)

    return redirect(SIGNED_IN_HOME)
  }
}

export async function GET(request: Request): Promise<Response> {
  const cookieStore = await cookies()

  return createGoogleCallbackRouteHandler({ cookieStore, fetcher: fetch })(request)
}
