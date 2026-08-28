import { NextResponse, type NextRequest } from 'next/server'

import { REDIRECT_PARAM_NAME, SIGNED_IN_HOME } from '@/lib/auth/redirect-target'
import { renewSession, type SessionRenewal } from '@/lib/auth/renew-session'
import { SESSIONS_ROUTE_PREFIX } from '@/lib/navigation/session-routes'
import { clearSessionCookies, hasLiveSession, sessionCookiesToSet } from '@/lib/auth/session'
import { clientEnv } from '@/lib/env/client'

const protectedRoutePrefixes = ['/history', SESSIONS_ROUTE_PREFIX]

// Routes whose only purpose is to start a session. Reaching them with a live
// session is always a dead end; /auth/callback and /auth/confirm are
// deliberately absent because they finish a link that may arrive either way.
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
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${CAPTCHA_ORIGIN}${developmentSource}`,
    // The toast library injects its stylesheet at runtime and cannot carry a
    // nonce, and a nonce in style-src would make the browser ignore this.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "media-src 'self' data: blob:",
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

// The update-password form acts on the session /auth/confirm just wrote, so it
// needs one; its invalid-link notice is the dead end of a recovery that never
// produced a session and has to stay reachable without one.
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

// Renewing on the incoming request is what lets the render that follows read
// the fresh access token: a Server Component can only read cookies.
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

// Prefetches are deliberately included: they are the only requests that reach a
// protected render without a proxy pass, and renewing the session is the one
// thing a Server Component cannot do for itself.
export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|wav|mp3|woff2?)$).*)',
  ],
}
