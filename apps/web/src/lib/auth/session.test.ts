import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  clearSessionCookies,
  hasLiveSession,
  readSessionCookies,
  writeSessionCookies,
} from './session'

type CookieOptions = {
  httpOnly: boolean
  maxAge: number
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
      maxAge: 2_592_000,
      path: '/',
      sameSite: 'lax',
      secure: true,
    })
    expect(store.optionsByName.get('mindness_refresh_token')).toEqual({
      httpOnly: true,
      maxAge: 2_592_000,
      path: '/',
      sameSite: 'lax',
      secure: true,
    })
  })

  it('outlives the browser session so a returning visitor stays signed in', () => {
    const store = new InMemoryCookieStore()

    writeSessionCookies(store, { accessToken: 'access-token', refreshToken: 'refresh-token' })

    expect(store.optionsByName.get('mindness_refresh_token')?.maxAge).toBeGreaterThan(86_400)
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

function accessTokenExpiringAt(expiresAtInSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ exp: expiresAtInSeconds }), 'utf8').toString(
    'base64url',
  )

  return `header.${payload}.signature`
}

describe('hasLiveSession', () => {
  const nowInSeconds = 1_700_000_000

  it('reports no session when no cookie was ever written', () => {
    expect(hasLiveSession(new InMemoryCookieStore(), nowInSeconds)).toBe(false)
  })

  it('reports a session while the access token is still valid', () => {
    const store = new InMemoryCookieStore()

    writeSessionCookies(store, {
      accessToken: accessTokenExpiringAt(nowInSeconds + 3_600),
      refreshToken: 'refresh-token',
    })

    expect(hasLiveSession(store, nowInSeconds)).toBe(true)
  })

  it('reports a session for an expired access token the refresh token can renew', () => {
    const store = new InMemoryCookieStore()

    writeSessionCookies(store, {
      accessToken: accessTokenExpiringAt(nowInSeconds - 1),
      refreshToken: 'refresh-token',
    })

    expect(hasLiveSession(store, nowInSeconds)).toBe(true)
  })

  it('reports no session for an expired access token with nothing left to renew it', () => {
    const store = new InMemoryCookieStore()

    store.set('mindness_access_token', accessTokenExpiringAt(nowInSeconds - 1), {
      httpOnly: true,
      maxAge: 60,
      path: '/',
      sameSite: 'lax',
      secure: false,
    })

    expect(hasLiveSession(store, nowInSeconds)).toBe(false)
  })

  it('fails closed on an access token whose payload cannot be read', () => {
    const store = new InMemoryCookieStore()

    for (const unreadableToken of ['not-a-jwt', 'header..signature', 'header.%%%.signature']) {
      store.set('mindness_access_token', unreadableToken, {
        httpOnly: true,
        maxAge: 60,
        path: '/',
        sameSite: 'lax',
        secure: false,
      })

      expect(hasLiveSession(store, nowInSeconds)).toBe(false)
    }
  })

  it('fails closed on an access token that carries no expiry claim', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'account-id' }), 'utf8').toString('base64url')
    const store = new InMemoryCookieStore()

    store.set('mindness_access_token', `header.${payload}.signature`, {
      httpOnly: true,
      maxAge: 60,
      path: '/',
      sameSite: 'lax',
      secure: false,
    })

    expect(hasLiveSession(store, nowInSeconds)).toBe(false)
  })
})
