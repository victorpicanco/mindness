import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { config, proxy } from './proxy'

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

function refreshedTokensResponse(): Response {
  return Response.json({
    data: {
      accessToken: accessTokenExpiringAt(FAR_FUTURE_EXPIRY_IN_SECONDS),
      refreshToken: 'rotated-refresh',
      expiresAt: '2026-08-24T13:00:00.000Z',
    },
  })
}

function stubApi(respond: (request: Request) => Response): Request[] {
  const requests: Request[] = []

  vi.stubGlobal('fetch', (input: RequestInfo | URL, init?: RequestInit) => {
    const apiRequest = new Request(input, init)
    requests.push(apiRequest)

    return Promise.resolve(respond(apiRequest))
  })

  return requests
}

function setCookieFor(response: Response, name: string): string | undefined {
  return response.headers.getSetCookie().find((setCookie) => setCookie.startsWith(`${name}=`))
}

beforeEach(() => {
  vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co/storage/v1')
  stubApi(() => refreshedTokensResponse())
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('proxy', () => {
  describe('routes that need a session', () => {
    it('redirects an unauthenticated request to the home route to sign-in', async () => {
      const response = await proxy(request('/'))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/auth/sign-in?redirect=%2F')
    })

    it('does not redirect an unauthenticated request to the removed practice route', async () => {
      const response = await proxy(request('/practice'))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('redirects an unauthenticated request to a session route to sign-in', async () => {
      const response = await proxy(request('/sessions/7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa'))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe(
        '/auth/sign-in?redirect=%2Fsessions%2F7d5f46c9-3cbd-4c6d-84aa-66b8148a91aa',
      )
    })

    it('allows an authenticated request to a protected route to continue', async () => {
      const response = await proxy(request('/history', signedIn()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('keeps a visitor whose access token expired but is still renewable', async () => {
      const response = await proxy(request('/history', staleAccessToken()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('redirects a protected request when nothing is left to renew the session', async () => {
      const response = await proxy(request('/history', expiredSession()))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/auth/sign-in?redirect=%2Fhistory')
    })

    it('redirects a protected request carrying an unreadable access token', async () => {
      const response = await proxy(
        request('/history', { cookie: 'mindness_access_token=not-a-jwt' }),
      )

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/auth/sign-in?redirect=%2Fhistory')
    })

    it('redirects an unauthenticated visitor away from the update-password form', async () => {
      const response = await proxy(request('/auth/update-password'))

      expect(response.status).toBe(307)
      expect(new URL(response.headers.get('location') ?? '').pathname).toBe('/auth/sign-in')
    })

    it('keeps an authenticated visitor on the update-password form', async () => {
      const response = await proxy(request('/auth/update-password', signedIn()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('lets the invalid-link notice of a failed recovery through without a session', async () => {
      const response = await proxy(request('/auth/update-password?status=invalid'))

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
    ])('sends an authenticated visitor away from %s', async (path) => {
      const response = await proxy(request(path, signedIn()))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/')
    })

    it('sends a visitor whose access token is merely stale away from sign-in', async () => {
      const response = await proxy(request('/auth/sign-in', staleAccessToken()))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/')
    })

    it('lets an expired session reach the sign-in route instead of looping', async () => {
      const response = await proxy(request('/auth/sign-in', expiredSession()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
    })

    it('lets a signed-in visitor finish an email or recovery link', async () => {
      for (const path of ['/auth/callback?access_token=a&refresh_token=b', '/auth/confirm']) {
        expect((await proxy(request(path, signedIn()))).headers.get('x-middleware-next')).toBe('1')
      }
    })
  })

  describe('silent session renewal', () => {
    it('renews an expired access token before the page renders', async () => {
      const apiRequests = stubApi(() => refreshedTokensResponse())

      const response = await proxy(request('/', staleAccessToken()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(apiRequests.map((apiRequest) => apiRequest.url)).toEqual([
        'https://api.mindness.test/auth/refresh',
      ])
      await expect(apiRequests[0]?.json()).resolves.toEqual({ refreshToken: 'refresh-token' })
    })

    it('hands the renewed tokens to the browser as httpOnly cookies', async () => {
      const response = await proxy(request('/', staleAccessToken()))

      expect(setCookieFor(response, 'mindness_access_token')).toContain('HttpOnly')
      expect(setCookieFor(response, 'mindness_refresh_token')).toContain('rotated-refresh')
    })

    it('forwards the renewed access token to the render of the same request', async () => {
      const response = await proxy(request('/', staleAccessToken()))

      expect(response.headers.get('x-middleware-request-cookie')).toContain('rotated-refresh')
    })

    it('never renews a session whose access token is still valid', async () => {
      const apiRequests = stubApi(() => refreshedTokensResponse())

      await proxy(request('/', signedIn()))

      expect(apiRequests).toHaveLength(0)
    })

    it('signs the visitor out when the refresh token is no longer accepted', async () => {
      stubApi(() =>
        Response.json(
          {
            error: {
              code: 'accounts.AUTHENTICATION_REJECTED',
              message: 'Authentication rejected',
              issues: null,
              requestId: 'request-id',
            },
          },
          { status: 401 },
        ),
      )

      const response = await proxy(request('/', staleAccessToken()))

      expect(response.status).toBe(307)
      expect(redirectTarget(response)).toBe('/auth/sign-in?redirect=%2F')
      expect(setCookieFor(response, 'mindness_access_token')).toContain('Expires=Thu, 01 Jan 1970')
      expect(setCookieFor(response, 'mindness_refresh_token')).toContain('Expires=Thu, 01 Jan 1970')
    })

    it('keeps the visitor signed in when the API cannot be reached', async () => {
      stubApi(() => {
        throw new TypeError('Failed to fetch')
      })

      const response = await proxy(request('/', staleAccessToken()))

      expect(response.headers.get('x-middleware-next')).toBe('1')
      expect(response.headers.getSetCookie()).toEqual([])
    })

    it('does not renew a session on a route that no longer needs one', async () => {
      const apiRequests = stubApi(() => refreshedTokensResponse())

      await proxy(request('/auth/sign-up'))

      expect(apiRequests).toHaveLength(0)
    })
  })

  describe('prefetch requests', () => {
    // Next strips the Flight headers from the request the proxy sees, so a
    // prefetch is indistinguishable here: the matcher is what includes it.
    it('renews an expired access token like any other request', async () => {
      const apiRequests = stubApi(() => refreshedTokensResponse())

      const response = await proxy(request('/', staleAccessToken()))

      expect(apiRequests.map((apiRequest) => apiRequest.url)).toEqual([
        'https://api.mindness.test/auth/refresh',
      ])
      expect(setCookieFor(response, 'mindness_refresh_token')).toContain('rotated-refresh')
    })
  })

  describe('security headers', () => {
    it('sets a CSP containing a per-request nonce', async () => {
      const response = await proxy(request('/'))
      const contentSecurityPolicy = response.headers.get('content-security-policy')

      expect(contentSecurityPolicy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
    })

    it('lets the toast library inject its runtime stylesheet', async () => {
      const response = await proxy(request('/auth/sign-in'))
      const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''

      expect(contentSecurityPolicy).toMatch(/style-src [^;]*'unsafe-inline'/u)
      expect(contentSecurityPolicy).not.toMatch(/script-src [^;]*'unsafe-inline'/u)
    })

    it('does not allow the removed external icon font origin', async () => {
      const response = await proxy(request('/auth/sign-in'))
      const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''

      expect(contentSecurityPolicy).not.toContain('use.hugeicons.com')
      expect(contentSecurityPolicy).toContain("font-src 'self'")
    })

    it('exposes the nonce to the app so inline scripts can carry it', async () => {
      const response = await proxy(request('/', signedIn()))
      const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''
      const nonce = /'nonce-([^']+)'/u.exec(contentSecurityPolicy)?.[1]

      expect(nonce).toBeDefined()
      expect(response.headers.get('x-middleware-request-x-nonce')).toBe(nonce)
    })

    it('allows the captcha widget to load, call home and frame its challenge', async () => {
      const response = await proxy(request('/auth/sign-in'))
      const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''

      expect(contentSecurityPolicy).toMatch(
        /script-src [^;]*https:\/\/challenges\.cloudflare\.com/u,
      )
      expect(contentSecurityPolicy).toMatch(
        /connect-src [^;]*'self'[^;]*https:\/\/challenges\.cloudflare\.com/u,
      )
      expect(contentSecurityPolicy).toContain("frame-src 'self' https://challenges.cloudflare.com")
    })

    it('allows direct uploads to the Supabase Storage origin', async () => {
      const response = await proxy(request('/auth/sign-in'))
      const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''

      expect(contentSecurityPolicy).toContain(
        "connect-src 'self' https://project.supabase.co https://challenges.cloudflare.com",
      )
    })

    it('keeps the security headers on a redirect', async () => {
      const response = await proxy(request('/practice'))

      expect(response.headers.get('x-frame-options')).toBe('DENY')
      expect(response.headers.get('content-security-policy')).toBeTruthy()
    })
  })
})

describe('proxy matcher', () => {
  it('runs on prefetch requests so a stale session is renewed before the render', () => {
    expect(JSON.stringify(config.matcher)).not.toContain('next-router-prefetch')
    expect(JSON.stringify(config.matcher)).not.toContain('prefetch')
  })
})
