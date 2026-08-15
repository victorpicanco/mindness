import { describe, expect, it } from 'vitest'

import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'

import { TimeZone } from './index.js'

describe('TimeZone', () => {
  it('accepts an IANA time zone', () => {
    expect(TimeZone.create('America/Sao_Paulo').value).toBe('America/Sao_Paulo')
  })

  it('rejects a value that is not an IANA time zone', () => {
    expect(() => TimeZone.create('invalid/time-zone')).toThrow(InvalidAccountValueError)
  })

  it('falls back to the default when no time zone was reported', () => {
    expect(TimeZone.fromOptional(undefined).value).toBe('America/Sao_Paulo')
  })

  it('falls back to the default when the reported time zone is unusable', () => {
    expect(TimeZone.fromOptional('invalid/time-zone').value).toBe('America/Sao_Paulo')
  })

  it('keeps a reported time zone that is usable', () => {
    expect(TimeZone.fromOptional('Europe/Lisbon').value).toBe('Europe/Lisbon')
  })

  it('compares by value, not by reference', () => {
    const timeZone = TimeZone.create('America/Sao_Paulo')

    expect(timeZone.equals(TimeZone.create('America/Sao_Paulo'))).toBe(true)
    expect(timeZone.equals(TimeZone.create('Europe/Lisbon'))).toBe(false)
  })
})
