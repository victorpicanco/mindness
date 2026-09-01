import { afterEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { ApiClientError } from '@/lib/api/client-error'

import { apiFetch, apiFetchWithMeta } from './server-client'

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

    const data = await apiFetch('/sessions/active', {
      schema: z.object({ sessionId: z.string() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: { sessionId: 'session-1' } }))
      },
    })

    expect(data).toEqual({ sessionId: 'session-1' })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/sessions/active')
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer access-token')
  })

  it('surfaces an unconfigured API base URL instead of reporting a network failure', async () => {
    vi.stubEnv('API_BASE_URL', '')

    const request = apiFetch('/sessions/active', {
      schema: z.object({ sessionId: z.string() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: () => Promise.reject(new TypeError('fetcher must never be reached')),
    })

    await expect(request).rejects.toMatchObject({ code: 'web.ENVIRONMENT_INVALID' })
  })

  it('translates network failures into an API client error', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const request = apiFetch('/sessions/active', {
      schema: z.object({ sessionId: z.string() }),
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

    const request = apiFetch('/sessions/active', {
      schema: z.object({ sessionId: z.string() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: () =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'sessions.SESSION_ALREADY_RUNNING',
                message: 'A session is already running.',
                issues: null,
                requestId: 'request-id',
              },
            },
            { status: 409 },
          ),
        ),
    })

    await expect(request).rejects.toMatchObject({
      code: 'sessions.SESSION_ALREADY_RUNNING',
      message: 'A session is already running.',
    } satisfies Pick<ApiClientError, 'code' | 'message'>)
  })

  it('rejects bodies that do not match the endpoint schema', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const request = apiFetch('/sessions/active', {
      schema: z.object({ sessionId: z.string() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: () => Promise.resolve(Response.json({ data: { sessionId: 42 } })),
    })

    await expect(request).rejects.toThrow()
  })

  it('translates an invalid API response into a client error', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const request = apiFetch('/sessions/active', {
      schema: z.object({ sessionId: z.string() }),
      cookieStore: new InMemoryCookieStore(undefined),
      fetcher: () => Promise.resolve(new Response('not json')),
    })

    await expect(request).rejects.toMatchObject({
      code: 'web.API_RESPONSE_INVALID',
    } satisfies Pick<ApiClientError, 'code'>)
  })

  it('does not mutate session cookies while handling a 401 during rendering', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const store = new InMemoryCookieStore('expired-access', 'valid-refresh')
    const requests: Request[] = []

    const request = apiFetch('/sessions/active', {
      schema: z.object({ sessionId: z.string() }),
      cookieStore: store,
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

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
      },
    })

    await expect(request).rejects.toMatchObject({ code: 'accounts.AUTHENTICATION_REJECTED' })
    expect(requests.map((item) => item.url)).toEqual(['https://api.mindness.test/sessions/active'])
  })
})

describe('apiFetchWithMeta', () => {
  it('returns the validated data beside the validated envelope metadata', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    await expect(
      apiFetchWithMeta('/sessions', {
        schema: z.array(z.object({ sessionId: z.string() })),
        metaSchema: z.object({ timeZone: z.string() }),
        cookieStore: new InMemoryCookieStore('access-token'),
        fetcher: () =>
          Promise.resolve(
            Response.json({
              data: [{ sessionId: 'session-1' }],
              meta: { timeZone: 'America/Sao_Paulo' },
            }),
          ),
      }),
    ).resolves.toEqual({
      data: [{ sessionId: 'session-1' }],
      meta: { timeZone: 'America/Sao_Paulo' },
    })
  })

  it('rejects metadata that does not match the endpoint schema', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const request = apiFetchWithMeta('/sessions', {
      schema: z.array(z.unknown()),
      metaSchema: z.object({ timeZone: z.string() }),
      cookieStore: new InMemoryCookieStore('access-token'),
      fetcher: () => Promise.resolve(Response.json({ data: [], meta: {} })),
    })

    await expect(request).rejects.toMatchObject({ code: 'web.API_RESPONSE_INVALID' })
  })
})
