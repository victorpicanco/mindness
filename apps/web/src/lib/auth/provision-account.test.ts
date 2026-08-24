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

type AccountConsent = {
  readonly purpose: 'voice_recording_and_analysis'
  readonly version: string
  readonly acceptedAt: string
}

function profileResponse(consent: AccountConsent | null): Response {
  return Response.json({
    data: {
      accountId: 'account-id',
      consent,
      email: 'person@example.com',
      plan: 'free',
      timeZone: 'America/Sao_Paulo',
    },
  })
}

function consentResponse(): Response {
  return Response.json({
    data: {
      purpose: 'voice_recording_and_analysis',
      version: '2026-08-15',
      acceptedAt: '2026-08-24T12:00:00.000Z',
    },
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('provisionAccount', () => {
  it('creates an absent account and records consent afterwards', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []

    const error = await provisionAccount({
      cookieStore: signedInCookieStore(),
      fetcher: (input, init) => {
        const request = new Request(input, init)
        requests.push(request)

        if (request.url.endsWith('/accounts/me')) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  code: 'accounts.ACCOUNT_NOT_FOUND',
                  message: 'Account not found',
                  issues: null,
                  requestId: 'request-id',
                },
              },
              { status: 404 },
            ),
          )
        }

        return Promise.resolve(
          request.url.endsWith('/accounts/me/consent')
            ? consentResponse()
            : Response.json({ data: { message: 'Account created.' } }),
        )
      },
    })

    expect(error).toBeNull()
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'GET https://api.mindness.test/accounts/me',
      'POST https://api.mindness.test/accounts',
      'POST https://api.mindness.test/accounts/me/consent',
    ])
  })

  it('does nothing when the account already has recorded consent', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []

    const error = await provisionAccount({
      cookieStore: signedInCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(
          profileResponse({
            purpose: 'voice_recording_and_analysis',
            version: '2026-08-15',
            acceptedAt: '2026-08-24T12:00:00.000Z',
          }),
        )
      },
    })

    expect(error).toBeNull()
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/accounts/me')
  })

  it('records consent for an existing account without it', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []

    const error = await provisionAccount({
      cookieStore: signedInCookieStore(),
      fetcher: (input, init) => {
        const request = new Request(input, init)
        requests.push(request)

        return Promise.resolve(
          request.url.endsWith('/accounts/me') ? profileResponse(null) : consentResponse(),
        )
      },
    })

    expect(error).toBeNull()
    expect(requests.map((request) => `${request.method} ${request.url}`)).toEqual([
      'GET https://api.mindness.test/accounts/me',
      'POST https://api.mindness.test/accounts/me/consent',
    ])
  })

  it('keeps the session and succeeds when consent recording fails after account creation', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = signedInCookieStore()

    const error = await provisionAccount({
      cookieStore,
      fetcher: (input, init) => {
        const request = new Request(input, init)

        if (request.url.endsWith('/accounts/me')) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  code: 'accounts.ACCOUNT_NOT_FOUND',
                  message: 'Account not found',
                  issues: null,
                  requestId: 'request-id',
                },
              },
              { status: 404 },
            ),
          )
        }

        if (request.url.endsWith('/accounts/me/consent')) {
          return Promise.resolve(
            Response.json(
              {
                error: {
                  code: 'accounts.CONSENT_REJECTED',
                  message: 'The consent could not be saved.',
                  issues: null,
                  requestId: 'request-id',
                },
              },
              { status: 422 },
            ),
          )
        }

        return Promise.resolve(Response.json({ data: { message: 'Account created.' } }))
      },
    })

    expect(error).toBeNull()
    expect(cookieStore.values).toEqual(
      new Map([
        ['mindness_access_token', 'access-token'],
        ['mindness_refresh_token', 'refresh-token'],
      ]),
    )
  })
})
