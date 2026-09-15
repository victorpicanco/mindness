import { describe, expect, it } from 'vitest'

import { GUEST_TRIAL_COOKIE_NAME, hasUsedGuestTrial, markGuestTrialUsed } from './index'

type WrittenCookie = {
  name: string
  value: string
  options: Parameters<Parameters<typeof markGuestTrialUsed>[0]['set']>[2]
}

function createCookieStore(initial: Readonly<Record<string, string>> = {}) {
  const written: WrittenCookie[] = []
  const values = new Map(Object.entries(initial))

  return {
    get: (name: string) => {
      const value = values.get(name)

      return value === undefined ? undefined : { value }
    },
    set: (name: string, value: string, options: WrittenCookie['options']) => {
      values.set(name, value)
      written.push({ name, options, value })
    },
    written,
  }
}

describe('guest trial cookie', () => {
  it('reports an untouched browser as eligible for the trial', () => {
    expect(hasUsedGuestTrial(createCookieStore())).toBe(false)
  })

  it('reports a browser that already consumed the trial', () => {
    const store = createCookieStore()

    markGuestTrialUsed(store)

    expect(hasUsedGuestTrial(store)).toBe(true)
  })

  it('ignores a marker the browser did not receive from this application', () => {
    expect(hasUsedGuestTrial(createCookieStore({ [GUEST_TRIAL_COOKIE_NAME]: 'maybe' }))).toBe(false)
  })

  it('keeps the marker out of browser scripts and alive for a year', () => {
    const store = createCookieStore()

    markGuestTrialUsed(store)

    expect(store.written).toEqual([
      {
        name: GUEST_TRIAL_COOKIE_NAME,
        options: {
          httpOnly: true,
          maxAge: 31_536_000,
          path: '/',
          sameSite: 'lax',
          secure: false,
        },
        value: 'true',
      },
    ])
  })
})
