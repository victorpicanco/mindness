import { describe, expect, it } from 'vitest'

import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'

import { EmailAddress } from './index.js'

describe('EmailAddress', () => {
  it('normalizes the address to lower case', () => {
    expect(EmailAddress.create('Person@Example.COM').value).toBe('person@example.com')
  })

  it('rejects an address without a valid shape', () => {
    expect(() => EmailAddress.create('invalid-email')).toThrow(InvalidAccountValueError)
  })

  it('rejects an address longer than the maximum length', () => {
    const local = 'a'.repeat(250)

    expect(() => EmailAddress.create(`${local}@example.com`)).toThrow(InvalidAccountValueError)
  })

  it('names the offending field in the error context', () => {
    expect(() => EmailAddress.create('invalid-email')).toThrow(
      expect.objectContaining({ context: { field: 'email' } }),
    )
  })

  it('compares by value, not by reference', () => {
    const address = EmailAddress.create('person@example.com')

    expect(address.equals(EmailAddress.create('PERSON@example.com'))).toBe(true)
    expect(address.equals(EmailAddress.create('other@example.com'))).toBe(false)
  })
})
