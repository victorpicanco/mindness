import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createEmailConfirmationRouteHandler } from './route'

class InMemoryCookieStore {
  readonly values = new Map<string, string>()

  get(name: string): { value: string } | undefined {
    const value = this.values.get(name)
    return value === undefined ? undefined : { value }
  }

  set(name: string, value: string): void {
    this.values.set(name, value)
  }

  delete(name: string): void {
    this.values.delete(name)
  }
}

describe('email confirmation route', () => {
  beforeEach(() => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })
  it('exchanges an email token hash, stores the session and redirects without leaking it', async () => {
    const store = new InMemoryCookieStore()
    const handler = createEmailConfirmationRouteHandler({
      cookieStore: store,
      fetcher: () =>
        Promise.resolve(
          Response.json({
            data: {
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresAt: '2026-08-15T13:00:00.000Z',
            },
          }),
        ),
    })

    const response = await handler(
      new Request('https://web.test/auth/confirm?token_hash=secret-hash&type=email'),
    )

    expect(response.headers.get('location')).toBe('https://web.test/auth/confirmed?status=success')
    expect(store.values.get('mindness_access_token')).toBe('access-token')
    expect(response.headers.get('location')).not.toContain('secret-hash')
  })

  it('redirects invalid or already-used links to an explicit error state', async () => {
    const handler = createEmailConfirmationRouteHandler({
      cookieStore: new InMemoryCookieStore(),
      fetcher: () =>
        Promise.resolve(
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
        ),
    })

    const response = await handler(
      new Request('https://web.test/auth/confirm?token_hash=used&type=email'),
    )

    expect(response.headers.get('location')).toBe('https://web.test/auth/confirmed?status=invalid')
  })

  it('routes a valid recovery link to the password update screen', async () => {
    const handler = createEmailConfirmationRouteHandler({
      cookieStore: new InMemoryCookieStore(),
      fetcher: () =>
        Promise.resolve(
          Response.json({
            data: {
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresAt: '2026-08-15T13:00:00.000Z',
            },
          }),
        ),
    })

    const response = await handler(
      new Request('https://web.test/auth/confirm?token_hash=recovery&type=recovery'),
    )

    expect(response.headers.get('location')).toBe('https://web.test/auth/update-password')
  })
})
