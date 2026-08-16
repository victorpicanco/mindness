import { describe, expect, it } from 'vitest'

import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'

import { ThemeTitle } from './index.js'

describe('ThemeTitle', () => {
  it('preserves the trimmed original title as its value', () => {
    expect(ThemeTitle.create('  Climate Change  ').value).toBe('Climate Change')
  })

  it('rejects a trimmed title outside the permitted length', () => {
    expect(() => ThemeTitle.create('  ab  ')).toThrow(
      expect.objectContaining({ context: { field: 'title' } }),
    )
    expect(() => ThemeTitle.create('a'.repeat(121))).toThrow(InvalidThemeValueError)
  })

  it('normalizes internal spaces and casing', () => {
    const title = ThemeTitle.create('Mudança  Climática ')

    expect(title.normalized).toBe('mudança climática')
  })

  it('compares normalized values', () => {
    expect(
      ThemeTitle.create('Mudança  Climática ').equals(ThemeTitle.create('mudança climática')),
    ).toBe(true)
  })
})
