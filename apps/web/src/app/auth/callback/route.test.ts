import { describe, expect, it } from 'vitest'

import { createGoogleCallbackRouteHandler } from './route'

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

describe('Google callback route', () => {
  it('writes session cookies and redirects to practice when both tokens are present', async () => {
    const cookieStore = new InMemoryCookieStore()
    const handler = createGoogleCallbackRouteHandler({ cookieStore })

    const response = await handler(
      new Request(
        'https://web.mindness.test/auth/callback?access_token=access-token&refresh_token=refresh-token',
      ),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://web.mindness.test/practice')
    expect(cookieStore.values).toEqual(
      new Map([
        ['mindness_access_token', 'access-token'],
        ['mindness_refresh_token', 'refresh-token'],
      ]),
    )
  })

  it('redirects to sign-in with an error without writing cookies when either token is absent', async () => {
    const cookieStore = new InMemoryCookieStore()
    const handler = createGoogleCallbackRouteHandler({ cookieStore })

    const response = await handler(
      new Request('https://web.mindness.test/auth/callback?access_token=access-token'),
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      'https://web.mindness.test/auth/sign-in?error=google_callback_failed',
    )
    expect(cookieStore.values).toEqual(new Map())
  })
})
