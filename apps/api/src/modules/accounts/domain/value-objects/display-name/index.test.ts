import { describe, expect, it } from 'vitest'

import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'

import { DisplayName, DISPLAY_NAME_MAX_LENGTH } from './index.js'

describe('DisplayName', () => {
  it('keeps the name the person typed', () => {
    expect(DisplayName.create('Maria Silva').value).toBe('Maria Silva')
  })

  it('trims the surrounding whitespace', () => {
    expect(DisplayName.create('  Maria Silva  ').value).toBe('Maria Silva')
  })

  it('rejects a name that is blank once trimmed', () => {
    expect(() => DisplayName.create('   ')).toThrow(InvalidAccountValueError)
  })

  it('accepts a name of exactly the maximum length', () => {
    const name = 'a'.repeat(DISPLAY_NAME_MAX_LENGTH)

    expect(DisplayName.create(name).value).toBe(name)
  })

  it('rejects a name longer than the maximum length', () => {
    expect(() => DisplayName.create('a'.repeat(DISPLAY_NAME_MAX_LENGTH + 1))).toThrow(
      InvalidAccountValueError,
    )
  })

  it('names the offending field in the error context', () => {
    expect(() => DisplayName.create('')).toThrow(
      expect.objectContaining({ context: { field: 'name' } }),
    )
  })

  it('compares by value, not by reference', () => {
    const name = DisplayName.create('Maria Silva')

    expect(name.equals(DisplayName.create('Maria Silva'))).toBe(true)
    expect(name.equals(DisplayName.create('Joana Silva'))).toBe(false)
  })
})
