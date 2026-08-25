import { afterEach, describe, expect, it, vi } from 'vitest'

import { createGoogleCallbackRouteHandler } from './route'

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

function provisionedFetcher(): typeof fetch {
  return () =>
    Promise.resolve(
      Response.json({
        data: {
          accountId: 'account-id',
          consent: {
            purpose: 'voice_recording_and_analysis',
            version: '2026-08-15',
            acceptedAt: '2026-08-24T12:00:00.000Z',
          },
        },
      }),
    )
}

const callbackUrl =
  'https://web.mindness.test/auth/callback?access_token=access-token&refresh_token=refresh-token'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Google callback route', () => {
  it('writes session cookies and redirects home when both tokens are present', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = new InMemoryCookieStore()
    const handler = createGoogleCallbackRouteHandler({
      cookieStore,
      fetcher: provisionedFetcher(),
    })

    const response = await handler(new Request(callbackUrl))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://web.mindness.test/')
    expect(cookieStore.values).toEqual(
      new Map([
        ['mindness_access_token', 'access-token'],
        ['mindness_refresh_token', 'refresh-token'],
      ]),
    )
  })

  it('provisions the account of the Google identity before redirecting', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const handler = createGoogleCallbackRouteHandler({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        const request = new Request(input, init)
        requests.push(request)

        return Promise.resolve(
          request.url.endsWith('/accounts/me')
            ? Response.json(
                {
                  error: {
                    code: 'accounts.ACCOUNT_NOT_FOUND',
                    message: 'Account not found',
                    issues: null,
                    requestId: 'request-id',
                  },
                },
                { status: 404 },
              )
            : request.url.endsWith('/accounts/me/consent')
              ? Response.json({
                  data: {
                    purpose: 'voice_recording_and_analysis',
                    version: '2026-08-15',
                    acceptedAt: '2026-08-24T12:00:00.000Z',
                  },
                })
              : Response.json({ data: { message: 'Account created.' } }),
        )
      },
    })

    await handler(new Request(callbackUrl))

    expect(requests.map((request) => request.url)).toEqual([
      'https://api.mindness.test/accounts/me',
      'https://api.mindness.test/accounts',
      'https://api.mindness.test/accounts/me/consent',
    ])
  })

  it('redirects to sign-in with an error without writing cookies when either token is absent', async () => {
    const cookieStore = new InMemoryCookieStore()
    const handler = createGoogleCallbackRouteHandler({
      cookieStore,
      fetcher: provisionedFetcher(),
    })

    const response = await handler(
      new Request('https://web.mindness.test/auth/callback?access_token=access-token'),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://web.mindness.test/auth/sign-in?error=google_callback_failed',
    )
    expect(cookieStore.values).toEqual(new Map())
  })

  it('sends the visitor back to sign-in when the account cannot be provisioned', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = new InMemoryCookieStore()
    const handler = createGoogleCallbackRouteHandler({
      cookieStore,
      fetcher: (input, init) => {
        const request = new Request(input, init)

        return Promise.resolve(
          request.url.endsWith('/accounts/me')
            ? Response.json(
                {
                  error: {
                    code: 'accounts.ACCOUNT_NOT_FOUND',
                    message: 'Account not found',
                    issues: null,
                    requestId: 'request-id',
                  },
                },
                { status: 404 },
              )
            : Response.json(
                {
                  error: {
                    code: 'accounts.BETA_CAPACITY_REACHED',
                    message: 'The beta has reached 100 accounts',
                    issues: null,
                    requestId: 'request-id',
                  },
                },
                { status: 409 },
              ),
        )
      },
    })

    const response = await handler(new Request(callbackUrl))

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://web.mindness.test/auth/sign-in?error=accounts.BETA_CAPACITY_REACHED',
    )
    expect(cookieStore.values).toEqual(new Map())
  })
})
