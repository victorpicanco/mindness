import { NextResponse, type NextRequest } from 'next/server'

import { SIGNED_IN_HOME } from '@/lib/auth/redirect-target'
import { renewSession, type SessionRenewal } from '@/lib/auth/renew-session'
import { SESSIONS_ROUTE_PREFIX } from '@/lib/navigation/session-routes'
import {
  clearSessionCookies,
  hasGuestSession,
  hasLiveSession,
  readSessionCookies,
  sessionCookiesToSet,
} from '@/lib/auth/session'
import { clientEnv } from '@/lib/env/client'

const protectedRoutePrefixes = [SESSIONS_ROUTE_PREFIX]
const signedOutOnlyRoutes = [
  '/auth/password-recovery',
  '/auth/resend-confirmation',
  '/auth/confirmed',
]

const removedAuthRoutes = ['/auth/sign-in', '/auth/sign-up']

const UPDATE_PASSWORD_ROUTE = '/auth/update-password'
const STATUS_PARAM_NAME = 'status'
const INVALID_LINK_STATUS = 'invalid'

const CAPTCHA_ORIGIN = 'https://challenges.cloudflare.com'
const NEXT_STREAMING_TIMING_SCRIPT_HASH = "'sha256-7mu4H06fwDCjmnxxr/xNHyuQC6pLTHr4M2E4jXw5WZs='"

function createContentSecurityPolicy(nonce: string, isSecureRequest: boolean): string {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const developmentSource = isDevelopment ? " 'unsafe-eval'" : ''
  const transportUpgrade = isDevelopment || !isSecureRequest ? [] : ['upgrade-insecure-requests']
  const storageOrigin = new URL(clientEnv().supabaseUrl).origin

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${NEXT_STREAMING_TIMING_SCRIPT_HASH} ${CAPTCHA_ORIGIN}${developmentSource}`,
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
    ...transportUpgrade,
  ].join('; ')
}

function matchesRoute(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
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

function setSecurityHeaders(
  response: NextResponse,
  contentSecurityPolicy: string,
  isSecureRequest: boolean,
): NextResponse {
  response.headers.set('Content-Security-Policy', contentSecurityPolicy)
  response.headers.set('Permissions-Policy', 'microphone=(self), camera=(), geolocation=()')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')

  if (process.env.NODE_ENV === 'production' && isSecureRequest) {
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
  const isSecureRequest =
    (request.headers.get('x-forwarded-proto') ?? request.nextUrl.protocol.slice(0, -1)) === 'https'
  const contentSecurityPolicy = createContentSecurityPolicy(nonce, isSecureRequest)
  const needsSession = requiresSession(request.nextUrl)
  const hadAccessToken = readSessionCookies(request.cookies).accessToken !== undefined
  const renewal = await renewSession({ cookieStore: request.cookies })

  applyRenewalToRequest(request, renewal)

  const isSignedIn = hasLiveSession(request.cookies)
  const isGuest = hasGuestSession(request.cookies)

  if (matchesRoute(request.nextUrl.pathname, removedAuthRoutes)) {
    const homeUrl = new URL(SIGNED_IN_HOME, request.url)
    homeUrl.search = request.nextUrl.search

    return applyRenewalToResponse(
      setSecurityHeaders(
        NextResponse.redirect(homeUrl, 308),
        contentSecurityPolicy,
        isSecureRequest,
      ),
      renewal,
    )
  }

  if (needsSession && !isSignedIn) {
    return applyRenewalToResponse(
      setSecurityHeaders(
        NextResponse.redirect(new URL(SIGNED_IN_HOME, request.url)),
        contentSecurityPolicy,
        isSecureRequest,
      ),
      renewal,
    )
  }

  if (isSignedOutOnlyRoute(request.nextUrl.pathname) && isSignedIn && hadAccessToken && !isGuest) {
    return applyRenewalToResponse(
      setSecurityHeaders(
        NextResponse.redirect(new URL(SIGNED_IN_HOME, request.url)),
        contentSecurityPolicy,
        isSecureRequest,
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
      isSecureRequest,
    ),
    renewal,
  )
}
export const config = {
  matcher: [
    {
      source:
        '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|wav|mp3|woff2?)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
