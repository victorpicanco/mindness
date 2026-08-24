import { describe, expect, it, vi } from 'vitest'

import {
  createEmailRequestAction,
  createSignOutAction,
  createUpdatePasswordAction,
} from './auth-flow-actions'
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

    await expect(recovery(formData)).resolves.toEqual({ status: 'success' })
    await expect(resend(formData)).resolves.toEqual({ status: 'success' })
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

    await expect(action(formData)).rejects.toThrow('redirected')
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
})
