import { describe, expect, it } from 'vitest'

import { accountDisplayName } from './index'

describe('accountDisplayName', () => {
  it('prefers the name the account was given', () => {
    expect(accountDisplayName({ email: 'person@example.com', name: 'Maria Silva' })).toBe(
      'Maria Silva',
    )
  })

  it('falls back to the local part of the email while the account has no name', () => {
    expect(accountDisplayName({ email: 'maria.silva@example.com', name: null })).toBe('maria.silva')
  })

  it('falls back to the whole email when it carries no local part', () => {
    expect(accountDisplayName({ email: 'person', name: null })).toBe('person')
  })
})
