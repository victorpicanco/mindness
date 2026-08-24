import { describe, expect, it } from 'vitest'

import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'

import { Password } from './index.js'

describe('Password', () => {
  it('accepts a password that meets every complexity requirement', () => {
    expect(Password.create('Strong_password1!').value).toBe('Strong_password1!')
  })

  it('accepts an eight-character password that meets every complexity requirement', () => {
    expect(Password.create('Abcdef1!').value).toBe('Abcdef1!')
  })

  it.each([
    ['shorter than the minimum length', 'Abcde1!'],
    ['without a lower case letter', 'STRONG_PASSWORD1!'],
    ['without an upper case letter', 'strong_password1!'],
    ['without a digit', 'Strong_password!!'],
    ['without a symbol', 'Strongpassword111'],
  ])('rejects a password %s', (_reason, value) => {
    expect(() => Password.create(value)).toThrow(InvalidAccountValueError)
  })

  it('compares by value, not by reference', () => {
    const password = Password.create('Strong_password1!')

    expect(password.equals(Password.create('Strong_password1!'))).toBe(true)
    expect(password.equals(Password.create('Another_password1!'))).toBe(false)
  })
})
