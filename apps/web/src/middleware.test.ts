import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { middleware } from './middleware'

describe('middleware', () => {
  it('redirects an unauthenticated request to a protected route to sign-in', () => {
    const response = middleware(new NextRequest('https://web.mindness.test/practice'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toBe('https://web.mindness.test/auth/sign-in')
  })

  it('allows an authenticated request to a protected route to continue', () => {
    const response = middleware(
      new NextRequest('https://web.mindness.test/history', {
        headers: { cookie: 'mindness_access_token=access-token' },
      }),
    )

    expect(response.headers.get('x-middleware-next')).toBe('1')
  })

  it('sets a CSP containing a per-request nonce', () => {
    const response = middleware(new NextRequest('https://web.mindness.test/'))
    const contentSecurityPolicy = response.headers.get('content-security-policy')

    expect(contentSecurityPolicy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/)
  })
})
