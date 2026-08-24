import { afterEach, describe, expect, it, vi } from 'vitest'

import { createAcceptConsentAction, initialConsentActionState } from './actions'

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

describe('acceptConsentAction', () => {
  it('records consent through the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const action = createAcceptConsentAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(
          Response.json({
            data: {
              purpose: 'voice_recording_and_analysis',
              version: '2026-08-15',
              acceptedAt: '2026-08-23T12:00:00.000Z',
            },
          }),
        )
      },
    })

    const result = await action(initialConsentActionState, new FormData())

    expect(result).toEqual({ status: 'success', messageKey: 'messages.consentRecorded' })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/accounts/me/consent')
    expect(requests[0]?.method).toBe('POST')
  })

  it('returns the API error details without exposing the API message', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const action = createAcceptConsentAction({
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

    const result = await action(initialConsentActionState, new FormData())

    expect(result).toEqual({
      status: 'api-error',
      error: {
        code: 'accounts.CONSENT_REJECTED',
        issues: null,
        requestId: 'request-id',
      },
    })
  })
})
