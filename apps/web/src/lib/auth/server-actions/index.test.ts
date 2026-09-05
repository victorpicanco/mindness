import { describe, expect, it, vi } from 'vitest'

import { initialAuthActionState } from '@/lib/auth/action-state'
import { createEmailRequestAction, createSignOutAction, createUpdatePasswordAction } from './index'
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
})
