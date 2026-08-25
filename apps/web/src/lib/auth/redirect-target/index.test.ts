import { describe, expect, it } from 'vitest'

import { REDIRECT_FIELD_NAME, REDIRECT_PARAM_NAME, SIGNED_IN_HOME, safeRedirectPath } from './index'

describe('safeRedirectPath', () => {
  it('keeps a local path and its query', () => {
    expect(safeRedirectPath('/practice/session?id=1')).toBe('/practice/session?id=1')
  })

  it('falls back to the signed-in home when nothing was requested', () => {
    expect(safeRedirectPath('')).toBe(SIGNED_IN_HOME)
    expect(safeRedirectPath(undefined)).toBe(SIGNED_IN_HOME)
    expect(safeRedirectPath(['/practice'])).toBe(SIGNED_IN_HOME)
  })

  it('refuses to send a visitor off-site', () => {
    expect(safeRedirectPath('https://evil.test/practice')).toBe(SIGNED_IN_HOME)
    expect(safeRedirectPath('//evil.test/practice')).toBe(SIGNED_IN_HOME)
    expect(safeRedirectPath('/\\evil.test/practice')).toBe(SIGNED_IN_HOME)
    expect(safeRedirectPath('practice')).toBe(SIGNED_IN_HOME)
  })

  it('never returns a visitor to the auth screens they just left', () => {
    expect(safeRedirectPath('/auth/sign-in')).toBe(SIGNED_IN_HOME)
    expect(safeRedirectPath('/auth/update-password')).toBe(SIGNED_IN_HOME)
  })

  it('names the query parameter and the form field the sign-in flow shares', () => {
    expect(REDIRECT_PARAM_NAME).toBe('redirect')
    expect(REDIRECT_FIELD_NAME).toBe('redirectTo')
  })
})
