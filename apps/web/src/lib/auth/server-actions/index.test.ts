import { describe, expect, it, vi } from 'vitest'
import type { EventMessage, IdentifyMessage } from 'posthog-node'

import { initialAuthActionState, initialStartGuestTrialState } from '@/lib/auth/action-state'
import { hasUsedGuestTrial, markGuestTrialUsed } from '@/lib/auth/guest-trial'
import type { AnalyticsClient } from '@/lib/analytics/posthog-server'
import {
  createEmailRequestAction,
  createSignInAction,
  createSignOutAction,
  createSignUpAction,
  createStartGuestTrialAction,
  createUpdatePasswordAction,
} from './index'
import { readSessionCookies, writeSessionCookies } from '@/lib/auth/session'

class InMemoryCookieStore {
  private readonly values = new Map<string, string>()

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

function success(message = 'Check your email'): Response {
  return Response.json({ data: { message } })
}

interface RecordingAnalytics extends AnalyticsClient {
  alias(message: { readonly alias: string; readonly distinctId: string }): void
  readonly aliases: { readonly alias: string; readonly distinctId: string }[]
  readonly captured: EventMessage[]
  readonly identified: IdentifyMessage[]
  readonly flushCount: () => number
}

function createRecordingAnalytics(flushError?: Error): RecordingAnalytics {
  const aliases: { readonly alias: string; readonly distinctId: string }[] = []
  const captured: EventMessage[] = []
  const identified: IdentifyMessage[] = []
  let flushCount = 0

  return {
    alias: (message) => {
      aliases.push(message)
    },
    aliases,
    captured,
    identified,
    flushCount: () => flushCount,
    capture: (message) => {
      captured.push(message)
    },
    identify: (message) => {
      identified.push(message)
    },
    flush: () => {
      flushCount += 1

      return flushError === undefined ? Promise.resolve() : Promise.reject(flushError)
    },
  }
}

function accountsMeResponse(): Response {
  return Response.json({
    data: {
      accountId: 'account-id',
      consent: {
        purpose: 'voice_recording_and_analysis',
        version: '2026-08-15',
        acceptedAt: '2026-08-24T12:00:00.000Z',
      },
    },
  })
}

describe('auth flow actions', () => {
  it('requests password recovery and confirmation resend with neutral success', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const paths: string[] = []
    const fetcher: typeof fetch = (input) => {
      paths.push(new Request(input).url)
      return Promise.resolve(success())
    }
    const recovery = createEmailRequestAction({
      path: '/auth/password/recovery',
      cookieStore: new InMemoryCookieStore(),
      fetcher,
    })
    const resend = createEmailRequestAction({
      path: '/auth/email/resend',
      cookieStore: new InMemoryCookieStore(),
      fetcher,
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('captchaToken', 'captcha-token')

    await expect(recovery(initialAuthActionState, formData)).resolves.toEqual({
      status: 'success',
    })
    await expect(resend(initialAuthActionState, formData)).resolves.toEqual({ status: 'success' })
    expect(paths).toEqual([
      'https://api.test/auth/password/recovery',
      'https://api.test/auth/email/resend',
    ])
  })

  it('updates the password, clears the recovery session and redirects', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    writeSessionCookies(store, { accessToken: 'access-token', refreshToken: 'refresh-token' })
    const navigate = vi.fn<(path: string) => never>(() => {
      throw new DOMException('redirected')
    })
    const action = createUpdatePasswordAction({
      cookieStore: store,
      fetcher: () => Promise.resolve(success('Password updated')),
      redirect: navigate,
    })
    const formData = new FormData()
    formData.set('password', 'New_password1!')

    await expect(action(initialAuthActionState, formData)).rejects.toThrow('redirected')
    expect(readSessionCookies(store)).toEqual({ accessToken: undefined, refreshToken: undefined })
    expect(navigate).toHaveBeenCalledWith('/?status=password-updated')
  })

  it('attempts global sign-out, always clears local cookies and redirects', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    writeSessionCookies(store, { accessToken: 'access-token', refreshToken: 'refresh-token' })
    const navigate = vi.fn<(path: string) => never>(() => {
      throw new DOMException('redirected')
    })
    const action = createSignOutAction({
      cookieStore: store,
      fetcher: () => Promise.resolve(success('Session ended')),
      redirect: navigate,
    })

    await expect(action()).rejects.toThrow('redirected')
    expect(readSessionCookies(store)).toEqual({ accessToken: undefined, refreshToken: undefined })
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('clears local cookies and redirects when global sign-out is unavailable', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    writeSessionCookies(store, { accessToken: 'access-token', refreshToken: 'refresh-token' })
    const navigate = vi.fn<(path: string) => never>(() => {
      throw new DOMException('redirected')
    })
    const action = createSignOutAction({
      cookieStore: store,
      fetcher: () => Promise.reject(new TypeError('network down')),
      redirect: navigate,
    })

    await expect(action()).rejects.toThrow('redirected')
    expect(readSessionCookies(store)).toEqual({ accessToken: undefined, refreshToken: undefined })
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('reports the API failure of an email request instead of swallowing it', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const action = createEmailRequestAction({
      path: '/auth/password/recovery',
      cookieStore: new InMemoryCookieStore(),
      fetcher: () =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'accounts.RATE_LIMITED',
                message: 'Too many attempts',
                issues: null,
                requestId: 'request-id',
              },
            },
            { status: 429 },
          ),
        ),
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('captchaToken', 'captcha-token')

    await expect(action(initialAuthActionState, formData)).resolves.toEqual({
      status: 'api-error',
      error: { code: 'accounts.RATE_LIMITED', issues: null, requestId: 'request-id' },
    })
  })

  it('rejects a password that does not meet the policy before calling the API', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const requests: string[] = []
    const action = createUpdatePasswordAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: (input) => {
        requests.push(new Request(input).url)

        return Promise.resolve(success('Password updated'))
      },
      redirect: (): never => {
        throw new DOMException('redirected')
      },
    })
    const formData = new FormData()
    formData.set('password', 'alllowercase1')

    await expect(action(initialAuthActionState, formData)).resolves.toEqual({
      status: 'validation-error',
      messageKey: 'errors.invalidPassword',
    })
    expect(requests).toEqual([])
  })

  it('reports the API failure of a password update instead of blaming the password', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const action = createUpdatePasswordAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: () => Promise.reject(new TypeError('network down')),
      redirect: (): never => {
        throw new DOMException('redirected')
      },
    })
    const formData = new FormData()
    formData.set('password', 'New_password1!')

    await expect(action(initialAuthActionState, formData)).resolves.toEqual({
      status: 'api-error',
      error: { code: 'web.API_REQUEST_FAILED', issues: null, requestId: null },
    })
  })

  it('identifies the account and reports sign-in to analytics', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const analytics = createRecordingAnalytics()
    const action = createSignInAction({
      cookieStore: new InMemoryCookieStore(),
      analytics,
      fetcher: (input) => {
        const request = new Request(input)

        return Promise.resolve(
          request.url.endsWith('/accounts/me')
            ? accountsMeResponse()
            : Response.json({
                data: {
                  accessToken: 'access-token',
                  refreshToken: 'refresh-token',
                  expiresAt: '2026-08-23T12:00:00.000Z',
                },
              }),
        )
      },
      redirect: (): never => {
        throw new DOMException('redirected')
      },
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('password', 'Valid_password1!')
    formData.set('captchaToken', 'captcha-token')
    formData.set('anonymousDistinctId', 'browser-anonymous-id')

    await expect(action(initialAuthActionState, formData)).rejects.toThrow('redirected')

    expect(analytics.captured).toEqual([
      { distinctId: 'person@example.com', event: 'sign_in_server' },
    ])
    expect(analytics.identified).toEqual([
      { distinctId: 'person@example.com', properties: { email: 'person@example.com' } },
    ])
    expect(analytics.aliases).toEqual([])
    expect(analytics.flushCount()).toBe(1)
  })

  it('does not report sign-in to analytics when the credentials are rejected', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const analytics = createRecordingAnalytics()
    const action = createSignInAction({
      cookieStore: new InMemoryCookieStore(),
      analytics,
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
      redirect: (): never => {
        throw new DOMException('redirected')
      },
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('password', 'Valid_password1!')
    formData.set('captchaToken', 'captcha-token')

    await action(initialAuthActionState, formData)

    expect(analytics.captured).toEqual([])
    expect(analytics.identified).toEqual([])
    expect(analytics.flushCount()).toBe(0)
  })

  it('identifies the account and reports sign-up to analytics', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const analytics = createRecordingAnalytics()
    const action = createSignUpAction({
      cookieStore: new InMemoryCookieStore(),
      analytics,
      fetcher: () => Promise.resolve(success('Check your email')),
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('password', 'Valid_password1!')
    formData.set('passwordConfirmation', 'Valid_password1!')
    formData.set('captchaToken', 'captcha-token')
    formData.set('anonymousDistinctId', 'browser-anonymous-id')

    await expect(action(initialAuthActionState, formData)).resolves.toEqual({ status: 'success' })

    expect(analytics.captured).toEqual([
      { distinctId: 'person@example.com', event: 'sign_up_server' },
    ])
    expect(analytics.identified).toEqual([
      { distinctId: 'person@example.com', properties: { email: 'person@example.com' } },
    ])
    expect(analytics.aliases).toEqual([])
    expect(analytics.flushCount()).toBe(1)
  })

  it('reports a distinct event for a password recovery request', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const analytics = createRecordingAnalytics()
    const action = createEmailRequestAction({
      path: '/auth/password/recovery',
      cookieStore: new InMemoryCookieStore(),
      analytics,
      fetcher: () => Promise.resolve(success()),
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('captchaToken', 'captcha-token')

    await action(initialAuthActionState, formData)

    expect(analytics.captured).toEqual([
      { distinctId: 'person@example.com', event: 'password_recovery_requested' },
    ])
    expect(analytics.flushCount()).toBe(1)
  })

  it('reports a distinct event for a confirmation email resend request', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const analytics = createRecordingAnalytics()
    const action = createEmailRequestAction({
      path: '/auth/email/resend',
      cookieStore: new InMemoryCookieStore(),
      analytics,
      fetcher: () => Promise.resolve(success()),
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('captchaToken', 'captcha-token')

    await action(initialAuthActionState, formData)

    expect(analytics.captured).toEqual([
      { distinctId: 'person@example.com', event: 'email_confirmation_resend_requested' },
    ])
    expect(analytics.flushCount()).toBe(1)
  })

  it('does not report an email request to analytics when it fails', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const analytics = createRecordingAnalytics()
    const action = createEmailRequestAction({
      path: '/auth/password/recovery',
      cookieStore: new InMemoryCookieStore(),
      analytics,
      fetcher: () =>
        Promise.resolve(
          Response.json(
            {
              error: {
                code: 'accounts.RATE_LIMITED',
                message: 'Too many attempts',
                issues: null,
                requestId: 'request-id',
              },
            },
            { status: 429 },
          ),
        ),
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('captchaToken', 'captcha-token')

    await action(initialAuthActionState, formData)

    expect(analytics.captured).toEqual([])
    expect(analytics.flushCount()).toBe(0)
  })

  it('does not turn a successful sign-up into an API error when analytics is unavailable', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const action = createSignUpAction({
      analytics: createRecordingAnalytics(new TypeError('analytics unavailable')),
      cookieStore: new InMemoryCookieStore(),
      fetcher: () => Promise.resolve(success()),
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('password', 'Valid_password1!')
    formData.set('passwordConfirmation', 'Valid_password1!')
    formData.set('captchaToken', 'captcha-token')

    await expect(action(initialAuthActionState, formData)).resolves.toEqual({ status: 'success' })
  })
})

describe('guest trial action', () => {
  function anonymousSession(): Response {
    return Response.json({
      data: {
        accessToken: 'anonymous-access-token',
        refreshToken: 'anonymous-refresh-token',
        expiresAt: '2026-09-10T13:00:00.000Z',
      },
    })
  }

  function apiFailure(code: string, status: number): Response {
    return Response.json(
      { error: { code, message: 'The request failed', issues: null, requestId: 'request-id' } },
      { status },
    )
  }

  function guestFormData(captchaToken = 'captcha-token'): FormData {
    const formData = new FormData()
    formData.set('captchaToken', captchaToken)
    formData.set('anonymousDistinctId', 'browser-anonymous-id')

    return formData
  }

  function createGuestFetcher(
    responses: Readonly<Record<string, Response | (() => Response)>>,
    requests: { readonly path: string; readonly body: string | null }[],
  ): typeof fetch {
    return (input, init) => {
      const path = new URL(new Request(input).url).pathname
      const body = typeof init?.body === 'string' ? init.body : null
      const response = responses[path]

      requests.push({ body, path })

      if (response === undefined) return Promise.resolve(apiFailure('shared.NOT_FOUND', 404))

      return Promise.resolve(typeof response === 'function' ? response() : response)
    }
  }

  it('refuses another anonymous identity once the browser consumed the trial', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    const requests: { readonly path: string; readonly body: string | null }[] = []
    markGuestTrialUsed(store)

    const action = createStartGuestTrialAction({
      cookieStore: store,
      fetcher: createGuestFetcher({}, requests),
    })

    await expect(action(initialStartGuestTrialState, guestFormData())).resolves.toEqual({
      status: 'account-required',
    })
    expect(requests).toEqual([])
    expect(readSessionCookies(store)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
    })
  })

  it('reuses an existing guest identity instead of minting another one', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    const requests: { readonly path: string; readonly body: string | null }[] = []
    const payload = Buffer.from(JSON.stringify({ is_anonymous: true }), 'utf8').toString(
      'base64url',
    )
    writeSessionCookies(store, {
      accessToken: `header.${payload}.signature`,
      refreshToken: 'anonymous-refresh-token',
    })

    const action = createStartGuestTrialAction({
      cookieStore: store,
      fetcher: createGuestFetcher({}, requests),
    })

    await expect(action(initialStartGuestTrialState, guestFormData())).resolves.toEqual({
      status: 'started',
    })
    expect(requests).toEqual([])
  })

  it('demands the captcha before minting an anonymous identity', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const requests: { readonly path: string; readonly body: string | null }[] = []

    const action = createStartGuestTrialAction({
      cookieStore: new InMemoryCookieStore(),
      fetcher: createGuestFetcher({}, requests),
    })

    await expect(action(initialStartGuestTrialState, guestFormData(''))).resolves.toEqual({
      status: 'captcha-required',
    })
    expect(requests).toEqual([])
  })

  it('signs in anonymously, provisions the guest account and records the consent', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    const requests: { readonly path: string; readonly body: string | null }[] = []
    const analytics = createRecordingAnalytics()
    const action = createStartGuestTrialAction({
      analytics,
      cookieStore: store,
      fetcher: createGuestFetcher(
        {
          '/auth/anonymous': anonymousSession,
          '/accounts': () => Response.json({ data: { message: 'Account created' } }),
          '/accounts/me/consent': () =>
            Response.json({
              data: {
                purpose: 'voice_recording_and_analysis',
                version: '2026-08-15',
                acceptedAt: '2026-09-10T12:00:00.000Z',
              },
            }),
        },
        requests,
      ),
    })

    await expect(action(initialStartGuestTrialState, guestFormData())).resolves.toEqual({
      status: 'started',
    })
    expect(requests.map((request) => request.path)).toEqual([
      '/auth/anonymous',
      '/accounts',
      '/accounts/me/consent',
    ])
    expect(requests[0]?.body).toBe(JSON.stringify({ captchaToken: 'captcha-token' }))
    expect(readSessionCookies(store)).toEqual({
      accessToken: 'anonymous-access-token',
      refreshToken: 'anonymous-refresh-token',
    })
    expect(analytics.captured).toEqual([
      { distinctId: 'browser-anonymous-id', event: 'anonymous_auth_succeeded' },
    ])
    expect(analytics.identified).toEqual([])
    expect(analytics.aliases).toEqual([])
  })

  it('keeps the trial available when the anonymous sign-in is rate limited', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    const requests: { readonly path: string; readonly body: string | null }[] = []
    const analytics = createRecordingAnalytics()
    const action = createStartGuestTrialAction({
      analytics,
      cookieStore: store,
      fetcher: createGuestFetcher(
        { '/auth/anonymous': () => apiFailure('accounts.RATE_LIMITED', 429) },
        requests,
      ),
    })

    await expect(action(initialStartGuestTrialState, guestFormData())).resolves.toEqual({
      status: 'api-error',
      error: { code: 'accounts.RATE_LIMITED', issues: null, requestId: 'request-id' },
    })
    expect(hasUsedGuestTrial(store)).toBe(false)
    expect(readSessionCookies(store)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
    })
    expect(analytics.captured).toEqual([
      {
        distinctId: 'browser-anonymous-id',
        event: 'anonymous_auth_failed',
        properties: { error_code: 'accounts.RATE_LIMITED' },
      },
    ])
    expect(analytics.identified).toEqual([])
  })

  it('preserves the API failure when analytics flushing also fails', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const requests: { readonly path: string; readonly body: string | null }[] = []
    const action = createStartGuestTrialAction({
      analytics: createRecordingAnalytics(new TypeError('analytics unavailable')),
      cookieStore: new InMemoryCookieStore(),
      fetcher: createGuestFetcher(
        { '/auth/anonymous': () => apiFailure('accounts.RATE_LIMITED', 429) },
        requests,
      ),
    })

    await expect(action(initialStartGuestTrialState, guestFormData())).resolves.toEqual({
      status: 'api-error',
      error: { code: 'accounts.RATE_LIMITED', issues: null, requestId: 'request-id' },
    })
  })

  it('drops the anonymous session when the guest account cannot be provisioned', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    const requests: { readonly path: string; readonly body: string | null }[] = []
    const action = createStartGuestTrialAction({
      cookieStore: store,
      fetcher: createGuestFetcher(
        {
          '/auth/anonymous': anonymousSession,
          '/accounts': () => apiFailure('shared.INTERNAL_ERROR', 500),
        },
        requests,
      ),
    })

    await expect(action(initialStartGuestTrialState, guestFormData())).resolves.toEqual({
      status: 'api-error',
      error: { code: 'shared.INTERNAL_ERROR', issues: null, requestId: 'request-id' },
    })
    expect(readSessionCookies(store)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
    })
    expect(hasUsedGuestTrial(store)).toBe(false)
  })

  it('drops the anonymous session when the consent cannot be recorded', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    const requests: { readonly path: string; readonly body: string | null }[] = []
    const action = createStartGuestTrialAction({
      cookieStore: store,
      fetcher: createGuestFetcher(
        {
          '/auth/anonymous': anonymousSession,
          '/accounts': () => Response.json({ data: { message: 'Account created' } }),
          '/accounts/me/consent': () => apiFailure('shared.INTERNAL_ERROR', 500),
        },
        requests,
      ),
    })

    await expect(action(initialStartGuestTrialState, guestFormData())).resolves.toEqual({
      status: 'api-error',
      error: { code: 'shared.INTERNAL_ERROR', issues: null, requestId: 'request-id' },
    })
    expect(readSessionCookies(store)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
    })
    expect(hasUsedGuestTrial(store)).toBe(false)
  })
})

describe('guest trial marker across authentication transitions', () => {
  it('keeps the consumed marker when a permanent account signs in', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    markGuestTrialUsed(store)
    writeSessionCookies(store, {
      accessToken: 'guest-access-token',
      refreshToken: 'guest-refresh-token',
    })
    const requestedPaths: string[] = []
    const action = createSignInAction({
      analytics: createRecordingAnalytics(),
      cookieStore: store,
      fetcher: (input) => {
        const path = new URL(new Request(input).url).pathname
        requestedPaths.push(path)

        return Promise.resolve(
          path === '/auth/sign-in'
            ? Response.json({
                data: {
                  accessToken: 'access-token',
                  refreshToken: 'refresh-token',
                  expiresAt: '2026-09-10T13:00:00.000Z',
                },
              })
            : accountsMeResponse(),
        )
      },
      redirect: () => {
        throw new DOMException('redirected')
      },
    })
    const formData = new FormData()
    formData.set('email', 'person@example.com')
    formData.set('password', 'a-valid-password')
    formData.set('captchaToken', 'captcha-token')

    await expect(action(initialAuthActionState, formData)).rejects.toThrow('redirected')
    expect(hasUsedGuestTrial(store)).toBe(true)
    expect(readSessionCookies(store)).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    expect(requestedPaths).toEqual(['/auth/sign-in', '/accounts/me'])
    expect(requestedPaths.every((path) => !path.includes('link') && !path.includes('migrat'))).toBe(
      true,
    )
  })

  it('keeps the consumed marker when the account signs out', async () => {
    vi.stubEnv('API_BASE_URL', 'https://api.test')
    const store = new InMemoryCookieStore()
    markGuestTrialUsed(store)
    writeSessionCookies(store, { accessToken: 'access-token', refreshToken: 'refresh-token' })
    const action = createSignOutAction({
      cookieStore: store,
      fetcher: () => Promise.resolve(success('Signed out')),
      redirect: () => {
        throw new DOMException('redirected')
      },
    })

    await expect(action()).rejects.toThrow('redirected')
    expect(hasUsedGuestTrial(store)).toBe(true)
    expect(readSessionCookies(store)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
    })
  })
})
