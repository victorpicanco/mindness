import { describe, expect, it } from 'vitest'

import { createRequireSession } from './require-session'

class RedirectSignal extends Error {
  constructor(readonly path: string) {
    super(path)
  }
}

class StubCookieStore {
  constructor(private readonly values: Readonly<Record<string, string>> = {}) {}

  get(name: string): { value: string } | undefined {
    const value = this.values[name]

    return value === undefined ? undefined : { value }
  }
}

function recordingRedirect(): { paths: string[]; redirect: (path: string) => never } {
  const paths: string[] = []

  return {
    paths,
    redirect: (path): never => {
      paths.push(path)
      throw new RedirectSignal(path)
    },
  }
}

describe('createRequireSession', () => {
  it('sends a visitor without a session to sign-in', () => {
    const { paths, redirect } = recordingRedirect()
    const requireSession = createRequireSession({ cookieStore: new StubCookieStore(), redirect })

    expect(() => {
      requireSession()
    }).toThrow(RedirectSignal)
    expect(paths).toEqual(['/auth/sign-in'])
  })

  it('lets a visitor with a renewable session through', () => {
    const { paths, redirect } = recordingRedirect()
    const requireSession = createRequireSession({
      cookieStore: new StubCookieStore({ mindness_refresh_token: 'refresh-token' }),
      redirect,
    })

    expect(() => {
      requireSession()
    }).not.toThrow()
    expect(paths).toEqual([])
  })

  it('sends a visitor carrying an unreadable access token to sign-in', () => {
    const { paths, redirect } = recordingRedirect()
    const requireSession = createRequireSession({
      cookieStore: new StubCookieStore({ mindness_access_token: 'not-a-jwt' }),
      redirect,
    })

    expect(() => {
      requireSession()
    }).toThrow(RedirectSignal)
    expect(paths).toEqual(['/auth/sign-in'])
  })
})
