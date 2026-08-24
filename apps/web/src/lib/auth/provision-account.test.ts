import { afterEach, describe, expect, it, vi } from 'vitest'

import { provisionAccount } from './provision-account'

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

function signedInCookieStore(): InMemoryCookieStore {
  const cookieStore = new InMemoryCookieStore()

  cookieStore.set('mindness_access_token', 'access-token')
  cookieStore.set('mindness_refresh_token', 'refresh-token')

  return cookieStore
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('provisionAccount', () => {
  it('does not recreate an account that already exists', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const cookieStore = signedInCookieStore()

    const error = await provisionAccount({
      cookieStore,
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(
          Response.json({
            data: {
              accountId: 'account-id',
              consent: null,
              email: 'person@example.com',
              plan: 'free',
              timeZone: 'America/Sao_Paulo',
            },
          }),
        )
      },
    })

    expect(error).toBeNull()
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/accounts/me')
    expect(requests[0]?.method).toBe('GET')
    expect(requests[0]?.headers.get('authorization')).toBe('Bearer access-token')
  })

  it('creates the account only when the signed-in identity has no account', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const cookieStore = signedInCookieStore()

    const error = await provisionAccount({
      cookieStore,
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
            : Response.json({ data: { message: 'Account created.' } }),
        )
      },
    })

    expect(error).toBeNull()
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'GET https://api.mindness.test/accounts/me',
      'POST https://api.mindness.test/accounts',
    ])
    await expect(requests[1]?.json()).resolves.toEqual({ timeZone: null })
  })

  it('clears the session and describes the failure when the API refuses to create the account', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = signedInCookieStore()

    const error = await provisionAccount({
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

    expect(error).toEqual({
      code: 'accounts.BETA_CAPACITY_REACHED',
      issues: null,
      requestId: 'request-id',
    })
    expect(cookieStore.values.size).toBe(0)
  })

  it('does not attempt account creation when the profile check fails unexpectedly', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = signedInCookieStore()
    const requests: Request[] = []

    const error = await provisionAccount({
      cookieStore,
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(
          Response.json(
            {
              error: {
                code: 'shared.INTERNAL_ERROR',
                message: 'Internal error',
                issues: null,
                requestId: 'request-id',
              },
            },
            { status: 500 },
          ),
        )
      },
    })

    expect(error).toEqual({
      code: 'shared.INTERNAL_ERROR',
      issues: null,
      requestId: 'request-id',
    })
    expect(requests).toHaveLength(1)
    expect(cookieStore.values.size).toBe(0)
  })
})
