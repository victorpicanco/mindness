import { afterEach, describe, expect, it, vi } from 'vitest'

import { renewSession, requestRefreshedTokens } from './index'

const NOW_IN_SECONDS = 1_700_000_000

class InMemoryCookieStore {
  private readonly values = new Map<string, string>()

  constructor(cookies: Record<string, string>) {
    for (const [name, value] of Object.entries(cookies)) this.values.set(name, value)
  }

  get(name: string): { value: string } | undefined {
    const value = this.values.get(name)

    return value === undefined ? undefined : { value }
  }
}

function accessTokenExpiringAt(expiresAtInSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAtInSeconds }), 'utf8').toString(
    'base64url',
  )

  return `header.${payload}.signature`
}

function refreshedTokensResponse(): Response {
  return Response.json({
    data: {
      accessToken: 'fresh-access',
      refreshToken: 'rotated-refresh',
      expiresAt: '2026-08-24T13:00:00.000Z',
    },
  })
}

function staleSession(): InMemoryCookieStore {
  return new InMemoryCookieStore({
    mindness_access_token: accessTokenExpiringAt(NOW_IN_SECONDS - 1),
    mindness_refresh_token: 'valid-refresh',
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('requestRefreshedTokens', () => {
  it('posts the refresh token and returns the rotated pair', async () => {
    const requests: Request[] = []

    const tokens = await requestRefreshedTokens({
      endpoint: 'https://api.mindness.test/auth/refresh',
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(refreshedTokensResponse())
      },
      refreshToken: 'valid-refresh',
    })

    expect(tokens).toEqual({ accessToken: 'fresh-access', refreshToken: 'rotated-refresh' })
    expect(requests[0]?.url).toBe('https://api.mindness.test/auth/refresh')
    expect(requests[0]?.method).toBe('POST')
    await expect(requests[0]?.json()).resolves.toEqual({ refreshToken: 'valid-refresh' })
  })

  it('reports a rejected refresh token as no tokens at all', async () => {
    const tokens = await requestRefreshedTokens({
      endpoint: 'https://api.mindness.test/auth/refresh',
      fetcher: () => Promise.resolve(Response.json({ error: {} }, { status: 401 })),
      refreshToken: 'revoked-refresh',
    })

    expect(tokens).toBeNull()
  })
})

describe('renewSession', () => {
  it('leaves a session whose access token is still valid untouched', async () => {
    const renewal = await renewSession({
      cookieStore: new InMemoryCookieStore({
        mindness_access_token: accessTokenExpiringAt(NOW_IN_SECONDS + 3_600),
        mindness_refresh_token: 'valid-refresh',
      }),
      fetcher: () => Promise.reject(new TypeError('the API must not be called')),
      nowInSeconds: NOW_IN_SECONDS,
    })

    expect(renewal).toEqual({ status: 'untouched' })
  })

  it('leaves a request with nothing to renew untouched', async () => {
    const renewal = await renewSession({
      cookieStore: new InMemoryCookieStore({}),
      fetcher: () => Promise.reject(new TypeError('the API must not be called')),
      nowInSeconds: NOW_IN_SECONDS,
    })

    expect(renewal).toEqual({ status: 'untouched' })
  })

  it('renews an expired access token from the refresh token', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const renewal = await renewSession({
      cookieStore: staleSession(),
      fetcher: () => Promise.resolve(refreshedTokensResponse()),
      nowInSeconds: NOW_IN_SECONDS,
    })

    expect(renewal).toEqual({
      status: 'renewed',
      tokens: { accessToken: 'fresh-access', refreshToken: 'rotated-refresh' },
    })
  })

  it('ends the session when the refresh token is no longer accepted', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const renewal = await renewSession({
      cookieStore: staleSession(),
      fetcher: () => Promise.resolve(Response.json({ error: {} }, { status: 401 })),
      nowInSeconds: NOW_IN_SECONDS,
    })

    expect(renewal).toEqual({ status: 'ended' })
  })

  it('keeps the session when the API cannot be reached at all', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const renewal = await renewSession({
      cookieStore: staleSession(),
      fetcher: () => Promise.reject(new TypeError('Failed to fetch')),
      nowInSeconds: NOW_IN_SECONDS,
    })

    expect(renewal).toEqual({ status: 'untouched' })
  })

  it('keeps the session when the API answers with a body it cannot read', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const renewal = await renewSession({
      cookieStore: staleSession(),
      fetcher: () => Promise.resolve(Response.json({ data: { accessToken: '' } })),
      nowInSeconds: NOW_IN_SECONDS,
    })

    expect(renewal).toEqual({ status: 'untouched' })
  })

  it('keeps the session when the API base URL is not configured', async () => {
    vi.stubEnv('API_BASE_URL', '')

    const renewal = await renewSession({
      cookieStore: staleSession(),
      fetcher: () => Promise.reject(new TypeError('the API must not be called')),
      nowInSeconds: NOW_IN_SECONDS,
    })

    expect(renewal).toEqual({ status: 'untouched' })
  })
})
