import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { readSessionCookies } from '@/lib/auth/session'
import type { ApiClientError } from '@/lib/api/client-error'

import { apiFetch } from './server-client'

class InMemoryCookieStore {
  private readonly values = new Map<string, string>()

  constructor(accessToken: string | undefined, refreshToken?: string) {
    if (accessToken !== undefined) {
      this.values.set('mindness_access_token', accessToken)
    }
    if (refreshToken !== undefined) this.values.set('mindness_refresh_token', refreshToken)
  }

  get(name: string): { value: string } | undefined {
    const value = this.values.get(name)

    return value === undefined ? undefined : { value }
  }

  set(name: string, value: string): void {
    this.values.set(name, value)
  }

  delete(): void {}
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('apiFetch', () => {
  it('sends the session access token and returns validated response data', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []

    const data = await apiFetch('/sessions/quota', {
      schema: z.object({ remaining: z.number() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: { remaining: 2 } }))
      },
    })

    expect(data).toEqual({ remaining: 2 })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/sessions/quota')
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer access-token')
  })

  it('surfaces an unconfigured API base URL instead of reporting a network failure', async () => {
    vi.stubEnv('API_BASE_URL', '')

    const request = apiFetch('/sessions/quota', {
      schema: z.object({ remaining: z.number() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: () => Promise.reject(new TypeError('fetcher must never be reached')),
    })

    await expect(request).rejects.toMatchObject({ code: 'web.ENVIRONMENT_INVALID' })
  })

  it('translates network failures into an API client error', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const request = apiFetch('/sessions/quota', {
      schema: z.object({ remaining: z.number() }),
      cookieStore: new InMemoryCookieStore(undefined),
      fetcher: async () => Promise.reject(new TypeError('network unavailable')),
    })

    await expect(request).rejects.toMatchObject({
      code: 'web.API_REQUEST_FAILED',
      message: 'Unable to reach the API.',
    } satisfies Pick<ApiClientError, 'code' | 'message'>)
  })

  it('preserves the backend error code and message', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const request = apiFetch('/sessions/quota', {
      schema: z.object({ remaining: z.number() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: () =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'quota.QUOTA_EXHAUSTED',
                message: 'The quota is exhausted.',
                issues: null,
                requestId: 'request-id',
              },
            },
            { status: 409 },
          ),
        ),
    })

    await expect(request).rejects.toMatchObject({
      code: 'quota.QUOTA_EXHAUSTED',
      message: 'The quota is exhausted.',
    } satisfies Pick<ApiClientError, 'code' | 'message'>)
  })

  it('rejects bodies that do not match the endpoint schema', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const request = apiFetch('/sessions/quota', {
      schema: z.object({ remaining: z.number() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: () => Promise.resolve(Response.json({ data: { remaining: 'two' } })),
    })

    await expect(request).rejects.toThrow()
  })

  it('translates an invalid API response into a client error', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const request = apiFetch('/sessions/quota', {
      schema: z.object({ remaining: z.number() }),
      cookieStore: new InMemoryCookieStore(undefined),
      fetcher: () => Promise.resolve(new Response('not json')),
    })

    await expect(request).rejects.toMatchObject({
      code: 'web.API_RESPONSE_INVALID',
    } satisfies Pick<ApiClientError, 'code'>)
  })

  it('refreshes an expired session once and retries the original request', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const store = new InMemoryCookieStore('expired-access', 'valid-refresh')
    const requests: Request[] = []

    const data = await apiFetch('/sessions/quota', {
      schema: z.object({ remaining: z.number() }),
      cookieStore: store,
      fetcher: (input, init) => {
        const request = new Request(input, init)
        requests.push(request)
        if (request.url.endsWith('/auth/refresh')) {
          return Promise.resolve(
            Response.json({
              data: {
                accessToken: 'fresh-access',
                refreshToken: 'rotated-refresh',
                expiresAt: '2026-08-15T13:00:00.000Z',
              },
            }),
          )
        }
        if (request.headers.get('authorization') === 'Bearer expired-access') {
          return Promise.resolve(
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
        }
        return Promise.resolve(Response.json({ data: { remaining: 2 } }))
      },
    })

    expect(data).toEqual({ remaining: 2 })
    expect(requests.map((request) => request.url)).toEqual([
      'https://api.mindness.test/sessions/quota',
      'https://api.mindness.test/auth/refresh',
      'https://api.mindness.test/sessions/quota',
    ])
    expect(readSessionCookies(store)).toEqual({
      accessToken: 'fresh-access',
      refreshToken: 'rotated-refresh',
    })
  })
})
