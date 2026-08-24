import { NextResponse, type NextRequest } from 'next/server'

import { REDIRECT_PARAM_NAME, SIGNED_IN_HOME } from '@/lib/auth/redirect-target'
import { hasLiveSession } from '@/lib/auth/session'

const protectedRoutePrefixes = ['/practice', '/history']

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

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${CAPTCHA_ORIGIN}${developmentSource}`,
    // The toast library injects its stylesheet at runtime and cannot carry a
    // nonce, and a nonce in style-src would make the browser ignore this.
    `style-src 'self' 'unsafe-inline' https://use.hugeicons.com`,
    "img-src 'self' blob: data:",
    "font-src 'self' https://use.hugeicons.com",
    `connect-src 'self' ${CAPTCHA_ORIGIN}`,
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

export function proxy(request: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID())
  const contentSecurityPolicy = createContentSecurityPolicy(nonce)
  const isSignedIn = hasLiveSession(request.cookies)

  if (requiresSession(request.nextUrl) && !isSignedIn) {
    return setSecurityHeaders(NextResponse.redirect(signInUrl(request)), contentSecurityPolicy)
  }

  if (isSignedOutOnlyRoute(request.nextUrl.pathname) && isSignedIn) {
    return setSecurityHeaders(
      NextResponse.redirect(new URL(SIGNED_IN_HOME, request.url)),
      contentSecurityPolicy,
    )
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy)
  requestHeaders.set('x-nonce', nonce)

  return setSecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    contentSecurityPolicy,
  )
}

export const config = {
  matcher: [
    {
      source: '/((?!api|_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
