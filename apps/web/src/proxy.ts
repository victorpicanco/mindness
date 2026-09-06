import { NextResponse, type NextRequest } from 'next/server'

import { REDIRECT_PARAM_NAME, SIGNED_IN_HOME } from '@/lib/auth/redirect-target'
import { renewSession, type SessionRenewal } from '@/lib/auth/renew-session'
import { SESSIONS_ROUTE_PREFIX } from '@/lib/navigation/session-routes'
import { clearSessionCookies, hasLiveSession, sessionCookiesToSet } from '@/lib/auth/session'
import { clientEnv } from '@/lib/env/client'

const protectedRoutePrefixes = [SESSIONS_ROUTE_PREFIX]
const signedOutOnlyRoutes = [
  '/auth/sign-in',
  '/auth/sign-up',
  '/auth/password-recovery',
  '/auth/resend-confirmation',
  '/auth/confirmed',
]

const SIGN_IN_ROUTE = '/auth/sign-in'
const UPDATE_PASSWORD_ROUTE = '/auth/update-password'
const STATUS_PARAM_NAME = 'status'
const INVALID_LINK_STATUS = 'invalid'

const CAPTCHA_ORIGIN = 'https://challenges.cloudflare.com'

function createContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const developmentSource = isDevelopment ? " 'unsafe-eval'" : ''
  const storageOrigin = new URL(clientEnv().supabaseUrl).origin

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${CAPTCHA_ORIGIN}${developmentSource}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    `media-src 'self' data: blob: ${storageOrigin}`,
    "font-src 'self'",
    `connect-src 'self' ${storageOrigin} ${CAPTCHA_ORIGIN}`,
    `frame-src 'self' ${CAPTCHA_ORIGIN}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

function matchesRoute(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
function requiresSession(url: NextRequest['nextUrl']): boolean {
  if (url.pathname === SIGNED_IN_HOME) return true
  if (matchesRoute(url.pathname, protectedRoutePrefixes)) return true

  return (
    url.pathname === UPDATE_PASSWORD_ROUTE &&
    url.searchParams.get(STATUS_PARAM_NAME) !== INVALID_LINK_STATUS
  )
}

function isSignedOutOnlyRoute(pathname: string): boolean {
  return matchesRoute(pathname, signedOutOnlyRoutes)
}

function signInUrl(request: NextRequest): URL {
  const url = new URL(SIGN_IN_ROUTE, request.url)
  const { pathname, search } = request.nextUrl

  url.searchParams.set(REDIRECT_PARAM_NAME, `${pathname}${search}`)

  return url
}

function setSecurityHeaders(response: NextResponse, contentSecurityPolicy: string): NextResponse {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  response.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }

  return response
}
function applyRenewalToRequest(request: NextRequest, renewal: SessionRenewal): void {
  if (renewal.status === 'renewed') {
    for (const { name, value } of sessionCookiesToSet(renewal.tokens)) {
      request.cookies.set(name, value)
    }
  }

  if (renewal.status === 'ended') clearSessionCookies(request.cookies)
}

function applyRenewalToResponse(response: NextResponse, renewal: SessionRenewal): NextResponse {
  if (renewal.status === 'renewed') {
    for (const { name, value, options } of sessionCookiesToSet(renewal.tokens)) {
      response.cookies.set(name, value, options)
    }
  }

  if (renewal.status === 'ended') clearSessionCookies(response.cookies)

  return response
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = btoa(crypto.randomUUID())
  const contentSecurityPolicy = createContentSecurityPolicy(nonce)
  const needsSession = requiresSession(request.nextUrl)
  const renewal = needsSession
    ? await renewSession({ cookieStore: request.cookies })
    : ({ status: 'untouched' } as const)

  applyRenewalToRequest(request, renewal)

  const isSignedIn = hasLiveSession(request.cookies)

  if (needsSession && !isSignedIn) {
    return applyRenewalToResponse(
      setSecurityHeaders(NextResponse.redirect(signInUrl(request)), contentSecurityPolicy),
      renewal,
    )
  }

  if (isSignedOutOnlyRoute(request.nextUrl.pathname) && isSignedIn) {
    return applyRenewalToResponse(
      setSecurityHeaders(
        NextResponse.redirect(new URL(SIGNED_IN_HOME, request.url)),
        contentSecurityPolicy,
      ),
      renewal,
    )
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)
  requestHeaders.set('x-nonce', nonce)

  return applyRenewalToResponse(
    setSecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } }),
      contentSecurityPolicy,
    ),
    renewal,
  )
}
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|wav|mp3|woff2?)$).*)',
  ],
}
