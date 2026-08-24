import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { proxy } from './proxy'

const FAR_FUTURE_EXPIRY_IN_SECONDS = 4_102_444_800

function accessTokenExpiringAt(expiresAtInSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAtInSeconds }), 'utf8').toString(
    'base64url',
  )

  return `header.${payload}.signature`
}

function signedIn(): { cookie: string } {
  return {
    cookie: `mindness_access_token=${accessTokenExpiringAt(FAR_FUTURE_EXPIRY_IN_SECONDS)}; mindness_refresh_token=refresh-token`,
  }
}

function staleAccessToken(): { cookie: string } {
  return {
    cookie: `mindness_access_token=${accessTokenExpiringAt(1)}; mindness_refresh_token=refresh-token`,
  }
}

function expiredSession(): { cookie: string } {
  return { cookie: `mindness_access_token=${accessTokenExpiringAt(1)}` }
}

function request(path: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(`https://web.mindness.test${path}`, { headers })
}

function redirectTarget(response: Response): string {
  const location = response.headers.get('location') ?? ''
  const { pathname, search } = new URL(location)

  return `${pathname}${search}`
}

describe('proxy', () => {
  describe('routes that need a session', () => {
    it('redirects an unauthenticated request to a protected route to sign-in', () => {
      const response = proxy(request('/practice'))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/auth/sign-in?redirect=%2Fpractice')
    })

    it('keeps the intended path and query so sign-in can return to it', () => {
      const response = proxy(request('/practice/session?id=1'))

      expect(new URL(response.headers.get('location') ?? '').searchParams.get('redirect')).toBe(
        '/practice/session?id=1',
      )
    })

    it('allows an authenticated request to a protected route to continue', () => {
      const response = proxy(request('/history', signedIn()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('keeps a visitor whose access token expired but is still renewable', () => {
      const response = proxy(request('/history', staleAccessToken()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('redirects a protected request when nothing is left to renew the session', () => {
      const response = proxy(request('/history', expiredSession()))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/auth/sign-in?redirect=%2Fhistory')
    })

    it('redirects a protected request carrying an unreadable access token', () => {
      const response = proxy(request('/history', { cookie: 'mindness_access_token=not-a-jwt' }))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/auth/sign-in?redirect=%2Fhistory')
    })

    it('redirects an unauthenticated visitor away from the update-password form', () => {
      const response = proxy(request('/auth/update-password'))

      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/auth/sign-in')
    })

    it('keeps an authenticated visitor on the update-password form', () => {
      const response = proxy(request('/auth/update-password', signedIn()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('lets the invalid-link notice of a failed recovery through without a session', () => {
      const response = proxy(request('/auth/update-password?status=invalid'))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })
  })

  describe('routes that only make sense signed out', () => {
    it.each([
      '/auth/sign-in',
      '/auth/sign-up',
      '/auth/password-recovery',
      '/auth/resend-confirmation',
      '/auth/confirmed',
    ])('sends an authenticated visitor away from %s', (path) => {
      const response = proxy(request(path, signedIn()))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/practice')
    })

    it('sends a visitor whose access token is merely stale away from sign-in', () => {
      const response = proxy(request('/auth/sign-in', staleAccessToken()))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/practice')
    })

    it('lets an expired session reach the sign-in route instead of looping', () => {
      const response = proxy(request('/auth/sign-in', expiredSession()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('lets a signed-in visitor finish an email or recovery link', () => {
      for (const path of ['/auth/callback?access_token=a&refresh_token=b', '/auth/confirm']) {
        expect(proxy(request(path, signedIn())).headers.get('x-middleware-next')).toBe('1')
      }
    })
  })

  describe('security headers', () => {
    it('sets a CSP containing a per-request nonce', () => {
      const response = proxy(request('/'))
      const contentSecurityPolicy = response.headers.get('content-security-policy')

      expect(contentSecurityPolicy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    })

    it('lets the toast library inject its runtime stylesheet', () => {
      const response = proxy(request('/auth/sign-in'))
      const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''

      expect(contentSecurityPolicy).toMatch(/style-src [^;]*'unsafe-inline'/u)
      expect(contentSecurityPolicy).not.toMatch(/script-src [^;]*'unsafe-inline'/u)
    })

    it('exposes the nonce to the app so inline scripts can carry it', () => {
      const response = proxy(request('/'))
      const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''
      const nonce = /'nonce-([^']+)'/u.exec(contentSecurityPolicy)?.[1]

      expect(nonce).toBeDefined()
      expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce)
    })

    it('allows the captcha widget to load, call home and frame its challenge', () => {
      const response = proxy(request('/auth/sign-in'))
      const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''

      expect(contentSecurityPolicy).toMatch(
        /script-src [^;]*https:\/\/challenges\.cloudflare\.com/u,
      )
      expect(contentSecurityPolicy).toContain(
        "connect-src 'self' https://challenges.cloudflare.com",
      )
      expect(contentSecurityPolicy).toContain("frame-src 'self' https://challenges.cloudflare.com")
    })

    it('keeps the security headers on a redirect', () => {
      const response = proxy(request('/practice'))

      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('content-security-policy')).toBeTruthy()
    })
  })
})
