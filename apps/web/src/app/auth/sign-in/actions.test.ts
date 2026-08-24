import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSignInAction, initialSignInActionState } from './actions'

class RedirectSignal extends Error {
  constructor(readonly path: string) {
    super(path)
  }
}

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

function createFormData(values: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [name, value] of Object.entries(values)) {
    formData.set(name, value)
  }

  return formData
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('signInAction', () => {
  it('validates the email and password before calling the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const requests: Request[] = []
    const signInAction = createSignInAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input, init) => {
        requests.push(new Request(input, init))

        return Promise.resolve(Response.json({ data: {} }))
      },
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = await signInAction(
      initialSignInActionState,
      createFormData({
        email: 'person@example.com',
        password: 'short',
        captchaToken: 'captcha-token',
      }),
    )

    expect(result).toEqual({
      status: 'error',
      messageKey: 'errors.invalidPassword',
    })
    expect(requests).toEqual([])
  })

  it('writes session cookies and redirects to practice after signing in', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = new InMemoryCookieStore()
    const signInAction = createSignInAction({
      cookieStore,
      fetcher: () =>
        Promise.resolve(
          Response.json({
            data: {
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresAt: '2026-08-23T12:00:00.000Z',
            },
          }),
        ),
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = signInAction(
      initialSignInActionState,
      createFormData({
        email: 'person@example.com',
        password: 'valid-password',
        captchaToken: 'captcha-token',
      }),
    )

    await expect(result).rejects.toMatchObject({ path: '/practice' })
    expect(cookieStore.values).toEqual(
      new Map([
        ['mindness_access_token', 'access-token'],
        ['mindness_refresh_token', 'refresh-token'],
      ]),
    )
  })

  it('turns backend login rejections into an actionable state', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const signInAction = createSignInAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: () =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'accounts.AUTHENTICATION_REJECTED',
                message: 'Invalid credentials.',
                issues: null,
                requestId: 'request-id',
              },
            },
            { status: 401 },
          ),
        ),
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = await signInAction(
      initialSignInActionState,
      createFormData({
        email: 'person@example.com',
        password: 'valid-password',
        captchaToken: 'captcha-token',
      }),
    )

    expect(result).toEqual({
      status: 'api-error',
      error: {
        code: 'accounts.AUTHENTICATION_REJECTED',
        issues: null,
        requestId: 'request-id',
      },
    })
  })
})
