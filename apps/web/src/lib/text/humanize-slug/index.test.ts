import { describe, expect, it } from 'vitest'

import { humanizeSlug } from './index'

describe('humanizeSlug', () => {
  it('replaces the hyphens of a slug with spaces', () => {
    expect(humanizeSlug('arte-e-cultura')).toBe('arte e cultura')
  })

  it('leaves a slug without hyphens untouched', () => {
    expect(humanizeSlug('news')).toBe('news')
  })
})
