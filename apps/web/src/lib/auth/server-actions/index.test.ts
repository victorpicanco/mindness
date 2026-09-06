import { describe, expect, it, vi } from 'vitest'
import type { EventMessage, IdentifyMessage } from 'posthog-node'

import { initialAuthActionState } from '@/lib/auth/action-state'
import type { AnalyticsClient } from '@/lib/analytics/posthog-server'
import {
  createEmailRequestAction,
  createSignInAction,
  createSignOutAction,
  createSignUpAction,
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
  readonly captured: EventMessage[]
  readonly identified: IdentifyMessage[]
  readonly flushCount: () => number
}

function createRecordingAnalytics(): RecordingAnalytics {
  const captured: EventMessage[] = []
  const identified: IdentifyMessage[] = []
  let flushCount = 0

  return {
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

      return Promise.resolve()
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
    expect(navigate).toHaveBeenCalledWith('/auth/sign-in?status=password-updated')
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
    expect(navigate).toHaveBeenCalledWith('/auth/sign-in')
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
    expect(navigate).toHaveBeenCalledWith('/auth/sign-in')
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

    await expect(action(initialAuthActionState, formData)).rejects.toThrow('redirected')

    expect(analytics.captured).toEqual([
      { distinctId: 'person@example.com', event: 'sign_in_server' },
    ])
    expect(analytics.identified).toEqual([
      { distinctId: 'person@example.com', properties: { email: 'person@example.com' } },
    ])
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

    await expect(action(initialAuthActionState, formData)).resolves.toEqual({ status: 'success' })

    expect(analytics.captured).toEqual([
      { distinctId: 'person@example.com', event: 'sign_up_server' },
    ])
    expect(analytics.identified).toEqual([
      { distinctId: 'person@example.com', properties: { email: 'person@example.com' } },
    ])
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
})
