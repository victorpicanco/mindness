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

    expect(result).toEqual({ status: 'success', message: 'Consentimento registrado.' })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.url).toBe('https://api.mindness.test/accounts/me/consent')
    expect(requests[0]?.method).toBe('POST')
  })
})
