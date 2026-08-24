import { describe, expect, it } from 'vitest'

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
      new Request('https://web.mindness.test/api/bff/sessions/quota?period=current', {
        body: JSON.stringify({ requested: true }),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
      }),
      context(['sessions', 'quota']),
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ data: { remaining: 2 } })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/sessions/quota?period=current')
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
          requests.filter((item) => item.url.endsWith('/sessions/quota')).length === 1
            ? new Response(null, { status: 401 })
            : Response.json({ data: { remaining: 1 } }),
        )
      },
    })

    const response = await handler(
      new Request('https://web.mindness.test/api/bff/sessions/quota'),
      context(['sessions', 'quota']),
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
      fetcher: () => Promise.resolve(new Response(null, { status: 401 })),
    })

    const response = await handler(
      new Request('https://web.mindness.test/api/bff/sessions/quota'),
      context(['sessions', 'quota']),
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
})
