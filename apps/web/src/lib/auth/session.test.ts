import { afterEach, describe, expect, it, vi } from 'vitest'

import { clearSessionCookies, readSessionCookies, writeSessionCookies } from './session'

type CookieOptions = {
  httpOnly: boolean
  path: string
  sameSite: 'lax'
  secure: boolean
}

class InMemoryCookieStore {
  readonly deletedNames: string[] = []
  readonly optionsByName = new Map<string, CookieOptions>()
  private readonly values = new Map<string, string>()

  get(name: string): { value: string } | undefined {
    const value = this.values.get(name)

    return value === undefined ? undefined : { value }
  }

  set(name: string, value: string, options: CookieOptions): void {
    this.values.set(name, value)
    this.optionsByName.set(name, options)
  }

  delete(name: string): void {
    this.values.delete(name)
    this.deletedNames.push(name)
  }
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('session cookies', () => {
  it('writes and reads httpOnly session cookies', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const store = new InMemoryCookieStore()

    writeSessionCookies(store, {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    expect(readSessionCookies(store)).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })
    expect(store.optionsByName.get('mindness_access_token')).toEqual({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: true,
    })
    expect(store.optionsByName.get('mindness_refresh_token')).toEqual({
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: true,
    })
  })

  it('does not require HTTPS cookies outside production', () => {
    vi.stubEnv('NODE_ENV', 'test')
    const store = new InMemoryCookieStore()

    writeSessionCookies(store, {
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    })

    expect(store.optionsByName.get('mindness_access_token')?.secure).toBe(false)
  })

  it('returns missing cookies and clears both session cookies', () => {
    const store = new InMemoryCookieStore()

    expect(readSessionCookies(store)).toEqual({
      accessToken: undefined,
      refreshToken: undefined,
    })

    clearSessionCookies(store)

    expect(store.deletedNames).toEqual(['mindness_access_token', 'mindness_refresh_token'])
  })
})
