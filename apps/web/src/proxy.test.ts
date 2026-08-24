import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { proxy } from './proxy'

describe('proxy', () => {
  it('redirects an unauthenticated request to a protected route to sign-in', () => {
    const response = proxy(new NextRequest('https://web.mindness.test/practice'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://web.mindness.test/auth/sign-in')
  })

  it('allows an authenticated request to a protected route to continue', () => {
    const response = proxy(
      new NextRequest('https://web.mindness.test/history', {
        headers: { cookie: 'mindness_access_token=access-token' },
      }),
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('redirects a protected request when the access token is already expired', () => {
    const payload = Buffer.from(JSON.stringify({ exp: 1 }), 'utf8').toString('base64url')
    const response = proxy(
      new NextRequest('https://web.mindness.test/history', {
        headers: { cookie: `mindness_access_token=header.${payload}.signature` },
      }),
    )

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://web.mindness.test/auth/sign-in')
  })

  it('sets a CSP containing a per-request nonce', () => {
    const response = proxy(new NextRequest('https://web.mindness.test/'))
    const contentSecurityPolicy = response.headers.get('content-security-policy')

    expect(contentSecurityPolicy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
  })

  it('allows the captcha widget to load, call home and frame its challenge', () => {
    const response = proxy(new NextRequest('https://web.mindness.test/auth/sign-in'))
    const contentSecurityPolicy = response.headers.get('content-security-policy') ?? ''

    expect(contentSecurityPolicy).toMatch(/script-src [^;]*https:\/\/challenges\.cloudflare\.com/u)
    expect(contentSecurityPolicy).toContain("connect-src 'self' https://challenges.cloudflare.com")
    expect(contentSecurityPolicy).toContain("frame-src 'self' https://challenges.cloudflare.com")
  })
})
