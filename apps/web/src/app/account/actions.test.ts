import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createAccountActions,
  initialDeleteAccountActionState,
  initialUpdateTimeZoneActionState,
} from './actions'

class RedirectSignal extends Error {
  constructor(readonly path: string) {
    super(path)
  }
}

class InMemoryCookieStore {
  readonly deletedNames: string[] = []

  get(): undefined {
    return undefined
  }

  set(): void {}

  delete(name: string): void {
    this.deletedNames.push(name)
  }
}

function createFormData(timeZone: string): FormData {
  const formData = new FormData()
  formData.set('timeZone', timeZone)

  return formData
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('account actions', () => {
  it('updates a valid IANA time zone through the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const accountActions = createAccountActions({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: { timeZone: 'Europe/Lisbon' } }))
      },
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = await accountActions.updateTimeZoneAction(
      initialUpdateTimeZoneActionState,
      createFormData('Europe/Lisbon'),
    )

    expect(result).toEqual({ status: 'success', messageKey: 'messages.timeZoneUpdated' })
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('PATCH')
    await expect(requests[0]?.json()).resolves.toEqual({ timeZone: 'Europe/Lisbon' })
  })

  it('rejects an invalid IANA time zone before calling the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const accountActions = createAccountActions({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: { timeZone: 'unexpected' } }))
      },
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = await accountActions.updateTimeZoneAction(
      initialUpdateTimeZoneActionState,
      createFormData('invalid/time-zone'),
    )

    expect(result).toEqual({ status: 'error', messageKey: 'errors.invalidTimeZone' })
    expect(requests).toEqual([])
  })

  it('returns the API error details without exposing the API message', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const accountActions = createAccountActions({
      cookieStore: new InMemoryCookieStore(),
      fetcher: () =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'accounts.TIME_ZONE_UPDATE_REJECTED',
                message: 'The time zone is not available.',
                issues: null,
                requestId: 'request-id',
              },
            },
            { status: 422 },
          ),
        ),
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = await accountActions.updateTimeZoneAction(
      initialUpdateTimeZoneActionState,
      createFormData('Europe/Lisbon'),
    )

    expect(result).toEqual({
      status: 'api-error',
      error: {
        code: 'accounts.TIME_ZONE_UPDATE_REJECTED',
        issues: null,
        requestId: 'request-id',
      },
    })
  })

  it('clears session cookies and redirects home after deleting the account', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = new InMemoryCookieStore()
    const accountActions = createAccountActions({
      cookieStore,
      fetcher: () =>
        Promise.resolve(Response.json({ data: { scheduledFor: '2026-09-22T12:00:00.000Z' } })),
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = accountActions.deleteAccountAction(
      initialDeleteAccountActionState,
      new FormData(),
    )

    await expect(result).rejects.toMatchObject({ path: '/' })
    expect(cookieStore.deletedNames).toEqual(['mindness_access_token', 'mindness_refresh_token'])
  })
})
