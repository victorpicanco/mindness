import { afterEach, describe, expect, it, vi } from 'vitest'

import { createSignInAction } from '@/lib/auth/server-actions'
import { initialAuthActionState } from '@/lib/auth/action-state'

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
      initialAuthActionState,
      createFormData({
        email: 'person@example.com',
        password: 'short',
        captchaToken: 'captcha-token',
      }),
    )

    expect(result).toEqual({
      status: 'validation-error',
      messageKey: 'errors.invalidPassword',
    })
    expect(requests).toEqual([])
  })

  it('requires a captcha token before calling the API', async () => {
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
      initialAuthActionState,
      createFormData({
        email: 'person@example.com',
        password: 'valid-password',
        captchaToken: '',
      }),
    )

    expect(result).toEqual({ status: 'validation-error', messageKey: 'errors.captchaRequired' })
    expect(requests).toEqual([])
  })

  it('writes session cookies and redirects an existing account home', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = new InMemoryCookieStore()
    const requests: Request[] = []
    const signInAction = createSignInAction({
      cookieStore,
      fetcher: (input, init) => {
        const request = new Request(input, init)
        requests.push(request)

        return Promise.resolve(
          request.url.endsWith('/accounts/me')
            ? Response.json({
                data: {
                  accountId: 'account-id',
                  consent: {
                    purpose: 'voice_recording_and_analysis',
                    version: '2026-08-15',
                    acceptedAt: '2026-08-24T12:00:00.000Z',
                  },
                },
              })
            : Response.json({
                data: {
                  accessToken: 'access-token',
                  refreshToken: 'refresh-token',
                  expiresAt: '2026-08-23T12:00:00.000Z',
                },
              }),
        )
      },
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = signInAction(
      initialAuthActionState,
      createFormData({
        email: 'person@example.com',
        password: 'valid-password',
        captchaToken: 'captcha-token',
      }),
    )

    await expect(result).rejects.toMatchObject({ path: '/' })
    expect(cookieStore.values).toEqual(
      new Map([
        ['mindness_access_token', 'access-token'],
        ['mindness_refresh_token', 'refresh-token'],
      ]),
    )
    expect(requests.map((request) => request.url)).toEqual([
      'https://api.mindness.test/auth/sign-in',
      'https://api.mindness.test/accounts/me',
    ])
  })

  it('clears the session when the API refuses to provision the account', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const cookieStore = new InMemoryCookieStore()
    const signInAction = createSignInAction({
      cookieStore,
      fetcher: (input, init) => {
        const request = new Request(input, init)

        return Promise.resolve(
          request.url.endsWith('/auth/sign-in')
            ? Response.json({
                data: {
                  accessToken: 'access-token',
                  refreshToken: 'refresh-token',
                  expiresAt: '2026-08-23T12:00:00.000Z',
                },
              })
            : request.url.endsWith('/accounts/me')
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
      redirect: (path): never => {
        throw new RedirectSignal(path)
      },
    })

    const result = await signInAction(
      initialAuthActionState,
      createFormData({
        email: 'person@example.com',
        password: 'valid-password',
        captchaToken: 'captcha-token',
      }),
    )

    expect(result).toEqual({
      status: 'api-error',
      error: { code: 'accounts.BETA_CAPACITY_REACHED', issues: null, requestId: 'request-id' },
    })
    expect(cookieStore.values.size).toBe(0)
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
      initialAuthActionState,
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

describe('signInAction redirect target', () => {
  function createSuccessfulSignInAction(): {
    signInAction: ReturnType<typeof createSignInAction>
  } {
    return {
      signInAction: createSignInAction({
        cookieStore: new InMemoryCookieStore(),
        fetcher: (input, init) => {
          const request = new Request(input, init)

          return Promise.resolve(
            request.url.endsWith('/accounts/me')
              ? Response.json({
                  data: {
                    accountId: 'account-id',
                    consent: {
                      purpose: 'voice_recording_and_analysis',
                      version: '2026-08-15',
                      acceptedAt: '2026-08-24T12:00:00.000Z',
                    },
                  },
                })
              : Response.json({
                  data: {
                    accessToken: 'access-token',
                    refreshToken: 'refresh-token',
                    expiresAt: '2026-08-23T12:00:00.000Z',
                  },
                }),
          )
        },
        redirect: (path): never => {
          throw new RedirectSignal(path)
        },
      }),
    }
  }

  const credentials = {
    email: 'person@example.com',
    password: 'valid-password',
    captchaToken: 'captcha-token',
  }

  it('returns the visitor to the page that bounced them', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const { signInAction } = createSuccessfulSignInAction()

    const result = signInAction(
      initialAuthActionState,
      createFormData({ ...credentials, redirectTo: '/practice/session?id=1' }),
    )

    await expect(result).rejects.toMatchObject({ path: '/practice/session?id=1' })
  })

  it('ignores a redirect target that would leave the app', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.mindness.test')
    const { signInAction } = createSuccessfulSignInAction()

    const result = signInAction(
      initialAuthActionState,
      createFormData({ ...credentials, redirectTo: 'https://evil.test/practice' }),
    )

    await expect(result).rejects.toMatchObject({ path: '/' })
  })
})
