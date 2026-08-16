import { describe, expect, it } from 'vitest'

import { InvalidThemeValueError } from '@/modules/themes/domain/errors/invalid-theme-value-error/index.js'

import { CategorySlug } from './index.js'

describe('CategorySlug', () => {
  it('accepts lower-case letters, numbers, and internal hyphens', () => {
    expect(CategorySlug.create('health-2').value).toBe('health-2')
  })

  it('normalizes the slug to lower case', () => {
    expect(CategorySlug.create('MINDFULNESS-2').value).toBe('mindfulness-2')
  })

  it.each(['', 'a', 'a'.repeat(41), 'saúde', 'mind fulness', '-mindfulness', 'mindfulness-'])(
    'rejects an invalid slug: %s',
    (value) => {
      expect(() => CategorySlug.create(value)).toThrow(InvalidThemeValueError)
    },
  )

  it('compares by value', () => {
    expect(CategorySlug.create('Mindfulness').equals(CategorySlug.create('mindfulness'))).toBe(true)
    expect(CategorySlug.create('mindfulness').equals(CategorySlug.create('sleep'))).toBe(false)
  })
})
