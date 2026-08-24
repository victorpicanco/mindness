import { NextResponse, type NextRequest } from 'next/server'

import { readSessionCookies } from '@/lib/auth/session'

const protectedRoutePrefixes = ['/practice', '/history']

const CAPTCHA_ORIGIN = 'https://challenges.cloudflare.com'

function createContentSecurityPolicy(nonce: string): string {
  const isDevelopment = process.env.NODE_ENV === 'development'
  const developmentSource = isDevelopment ? " 'unsafe-eval'" : ''

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' ${CAPTCHA_ORIGIN}${developmentSource}`,
    `style-src 'self' 'nonce-${nonce}' https://use.hugeicons.com`,
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

function isProtectedRoute(pathname: string): boolean {
  return protectedRoutePrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

function accessTokenIsExpired(accessToken: string, nowInSeconds = Date.now() / 1000): boolean {
  const payload = accessToken.split('.')[1]
  if (payload === undefined) return false

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (typeof decoded !== 'object' || decoded === null || !('exp' in decoded)) return false
    const expiresAt = decoded.exp
    return typeof expiresAt === 'number' && expiresAt <= nowInSeconds
  } catch {
    return false
  }
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
  const { accessToken } = readSessionCookies(request.cookies)

  if (
    isProtectedRoute(request.nextUrl.pathname) &&
    (accessToken === undefined || accessTokenIsExpired(accessToken))
  ) {
    return setSecurityHeaders(
      NextResponse.redirect(new URL('/auth/sign-in', request.url)),
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
