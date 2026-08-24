import { afterEach, describe, expect, it, vi } from 'vitest'

import { acceptConsent } from './accept-consent'

class InMemoryCookieStore {
  get(): undefined {
    return undefined
  }

  set(): void {}

  delete(): void {}
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('acceptConsent', () => {
  it('records consent through the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []

    const error = await acceptConsent({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(
          Response.json({
            data: {
              purpose: 'voice_recording_and_analysis',
              version: '2026-08-15',
              acceptedAt: '2026-08-24T12:00:00.000Z',
            },
          }),
        )
      },
    })

    expect(error).toBeNull()
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/accounts/me/consent')
    expect(requests[0]?.method).toBe('POST')
  })

  it('returns API error details without exposing the API message', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')

    const error = await acceptConsent({
      cookieStore: new InMemoryCookieStore(),
      fetcher: () =>
        Promise.resolve(
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
        ),
    })

    expect(error).toEqual({
      code: 'accounts.CONSENT_REJECTED',
      issues: null,
      requestId: 'request-id',
    })
  })
})
