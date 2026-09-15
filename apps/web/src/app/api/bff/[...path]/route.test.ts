import { describe, expect, it } from 'vitest'

import { hasUsedGuestTrial } from '@/lib/auth/guest-trial'

import { createBffRouteHandler } from './route'

class InMemoryCookieStore {
  readonly deletedNames: string[] = []
  private readonly values = new Map<string, string>()

  constructor(tokens: { accessToken: string; refreshToken: string }) {
    this.values.set('mindness_access_token', tokens.accessToken)
    this.values.set('mindness_refresh_token', tokens.refreshToken)
  }

  get(name: string): { value: string } | undefined {
    const value = this.values.get(name)

    return value === undefined ? undefined : { value }
  }

  set(name: string, value: string): void {
    this.values.set(name, value)
  }

  delete(name: string): void {
    this.values.delete(name)
    this.deletedNames.push(name)
  }
}

function context(path: string[]): { params: Promise<{ path: string[] }> } {
  return { params: Promise.resolve({ path }) }
}

describe('BFF proxy route', () => {
  it('forwards the request method, body, authorization and response', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    const requests: Request[] = []
    const handler = createBffRouteHandler({
      apiBaseUrl: 'https://api.mindness.test',
      cookieStore,
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: { remaining: 2 } }))
      },
    })

    const response = await handler(
      new Request('https://web.mindness.test/api/bff/sessions/active?period=current', {
        body: JSON.stringify({ requested: true }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
      context(['sessions', 'active']),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { remaining: 2 } })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/sessions/active?period=current')
    expect(requests[0]?.method).toBe('POST')
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer access-token')
    await expect(requests[0]?.text()).resolves.toBe('{"requested":true}')
  })

  it('refreshes the session once and retries the original request after a 401', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
    })
    const requests: Request[] = []
    const handler = createBffRouteHandler({
      apiBaseUrl: 'https://api.mindness.test',
      cookieStore,
      fetcher: (input, init) => {
        const request = new Request(input, init)
        requests.push(request)

        if (request.url.endsWith('/auth/refresh')) {
          return Promise.resolve(
            Response.json({
              data: {
                accessToken: 'new-access-token',
                expiresAt: '2026-08-23T12:00:00.000Z',
                refreshToken: 'new-refresh-token',
              },
            }),
          )
        }

        return Promise.resolve(
          requests.filter((item) => item.url.endsWith('/sessions/active')).length === 1
            ? new Response(null, { status: 401 })
            : Response.json({ data: { remaining: 1 } }),
        )
      },
    })

    const response = await handler(
      new Request('https://web.mindness.test/api/bff/sessions/active'),
      context(['sessions', 'active']),
    )

    expect(response.status).toBe(200)
    expect(requests).toHaveLength(3)
    expect(requests[1]?.url).toBe('https://api.mindness.test/auth/refresh')
    await expect(requests[1]?.json()).resolves.toEqual({ refreshToken: 'refresh-token' })
    expect(requests[2]?.headers.get('authorization')).toBe('Bearer new-access-token')
    expect(cookieStore.get('mindness_access_token')?.value).toBe('new-access-token')
    expect(cookieStore.get('mindness_refresh_token')?.value).toBe('new-refresh-token')
  })

  it('clears cookies and returns 401 when the refresh fails', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: 'expired-access-token',
      refreshToken: 'expired-refresh-token',
    })
    const handler = createBffRouteHandler({
      apiBaseUrl: 'https://api.mindness.test',
      cookieStore,
      fetcher: (input) =>
        Promise.resolve(
          new URL(new Request(input).url).pathname === '/auth/refresh'
            ? Response.json(
                {
                  error: {
                    code: 'accounts.AUTHENTICATION_REJECTED',
                    message: 'Authentication rejected',
                    issues: null,
                    requestId: 'request-id',
                  },
                },
                { status: 401 },
              )
            : new Response(null, { status: 401 }),
        ),
    })

    const response = await handler(
      new Request('https://web.mindness.test/api/bff/sessions/active'),
      context(['sessions', 'active']),
    )

    expect(response.status).toBe(401)
    expect(cookieStore.deletedNames).toEqual(['mindness_access_token', 'mindness_refresh_token'])
    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: 'web.AUTHENTICATION_EXPIRED',
        issues: null,
      },
    })
  })

  it('preserves cookies and reports temporary unavailability when refresh returns 503', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
    })
    const handler = createBffRouteHandler({
      apiBaseUrl: 'https://api.mindness.test',
      cookieStore,
      fetcher: (input) =>
        Promise.resolve(
          new URL(new Request(input).url).pathname === '/auth/refresh'
            ? Response.json({ error: {} }, { status: 503 })
            : new Response(null, { status: 401 }),
        ),
    })

    const response = await handler(
      new Request('https://web.mindness.test/api/bff/sessions/active'),
      context(['sessions', 'active']),
    )

    expect(response.status).toBe(503)
    expect(cookieStore.deletedNames).toEqual([])
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'web.AUTHENTICATION_UNAVAILABLE' },
    })
  })
})

describe('BFF guest trial marker', () => {
  function anonymousToken(isAnonymous: boolean): string {
    const payload = Buffer.from(
      JSON.stringify({ exp: 4_102_444_800, is_anonymous: isAnonymous, sub: 'user' }),
    ).toString('base64url')

    return `header.${payload}.signature`
  }

  function startSessionRequest(): Request {
    return new Request('https://web.mindness.test/api/bff/sessions', {
      body: JSON.stringify({ difficulty: 'balanced' }),
      headers: { 'content-type': 'application/json' },
      method: 'POST',
    })
  }

  function createHandler(cookieStore: InMemoryCookieStore, response: () => Response) {
    return createBffRouteHandler({
      apiBaseUrl: 'https://api.mindness.test',
      cookieStore,
      fetcher: () => Promise.resolve(response()),
    })
  }

  it('remembers the consumed trial after a guest session is created', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: anonymousToken(true),
      refreshToken: 'refresh-token',
    })
    const handler = createHandler(cookieStore, () =>
      Response.json({ data: { sessionId: 'session-id' } }, { status: 201 }),
    )

    await handler(startSessionRequest(), context(['sessions']))

    expect(hasUsedGuestTrial(cookieStore)).toBe(true)
  })

  it('leaves the marker alone for a session created by a permanent account', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: anonymousToken(false),
      refreshToken: 'refresh-token',
    })
    const handler = createHandler(cookieStore, () =>
      Response.json({ data: { sessionId: 'session-id' } }, { status: 201 }),
    )

    await handler(startSessionRequest(), context(['sessions']))

    expect(hasUsedGuestTrial(cookieStore)).toBe(false)
  })

  it('does not consume the trial when the session is refused', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: anonymousToken(true),
      refreshToken: 'refresh-token',
    })
    const handler = createHandler(cookieStore, () =>
      Response.json(
        {
          error: {
            code: 'sessions.THEME_UNAVAILABLE',
            message: 'No theme',
            issues: null,
            requestId: 'request-id',
          },
        },
        { status: 422 },
      ),
    )

    await handler(startSessionRequest(), context(['sessions']))

    expect(hasUsedGuestTrial(cookieStore)).toBe(false)
  })

  it('synchronises the marker when the API reports the trial as already consumed', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: anonymousToken(true),
      refreshToken: 'refresh-token',
    })
    const handler = createHandler(cookieStore, () =>
      Response.json(
        {
          error: {
            code: 'sessions.GUEST_TRIAL_CONSUMED',
            message: 'The guest trial of this account was already used',
            issues: null,
            requestId: 'request-id',
          },
        },
        { status: 403 },
      ),
    )

    const response = await handler(startSessionRequest(), context(['sessions']))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'sessions.GUEST_TRIAL_CONSUMED' },
    })
    expect(hasUsedGuestTrial(cookieStore)).toBe(true)
  })

  it('keeps the trial available when another rule refuses the session', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: anonymousToken(true),
      refreshToken: 'refresh-token',
    })
    const handler = createHandler(cookieStore, () =>
      Response.json(
        {
          error: {
            code: 'sessions.PRACTICE_NOT_ALLOWED',
            message: 'Consent is required',
            issues: null,
            requestId: 'request-id',
          },
        },
        { status: 403 },
      ),
    )

    await handler(startSessionRequest(), context(['sessions']))

    expect(hasUsedGuestTrial(cookieStore)).toBe(false)
  })

  it('only marks the trial for the session creation route', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: anonymousToken(true),
      refreshToken: 'refresh-token',
    })
    const handler = createHandler(cookieStore, () =>
      Response.json({ data: { recordingId: 'recording-id' } }, { status: 201 }),
    )

    await handler(
      new Request('https://web.mindness.test/api/bff/sessions/session-id/recordings', {
        method: 'POST',
      }),
      context(['sessions', 'session-id', 'recordings']),
    )

    expect(hasUsedGuestTrial(cookieStore)).toBe(false)
  })

  it('marks the trial with the token the request was retried with', async () => {
    const cookieStore = new InMemoryCookieStore({
      accessToken: 'expired-access-token',
      refreshToken: 'refresh-token',
    })
    const responses = [
      () => Response.json({ error: { code: 'x', message: 'x', issues: null } }, { status: 401 }),
      () =>
        Response.json({
          data: {
            accessToken: anonymousToken(true),
            expiresAt: '2100-01-01T00:00:00.000Z',
            refreshToken: 'next-refresh-token',
          },
        }),
      () => Response.json({ data: { sessionId: 'session-id' } }, { status: 201 }),
    ]
    let attempt = 0
    const handler = createBffRouteHandler({
      apiBaseUrl: 'https://api.mindness.test',
      cookieStore,
      fetcher: () => {
        const respond = responses[attempt]
        attempt += 1

        return Promise.resolve(respond === undefined ? new Response(null) : respond())
      },
    })

    await handler(startSessionRequest(), context(['sessions']))

    expect(hasUsedGuestTrial(cookieStore)).toBe(true)
  })
})
