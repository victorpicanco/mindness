import { describe, expect, it } from 'vitest'

import { THEME_POOL_MINIMUM, ThemePoolMonitor } from './index.js'

describe('ThemePoolMonitor', () => {
  it('returns empty when no published themes are available', () => {
    expect(ThemePoolMonitor.evaluate(0)).toBe('empty')
  })

  it('returns low below the named minimum', () => {
    expect(THEME_POOL_MINIMUM).toBe(10)
    expect(ThemePoolMonitor.evaluate(THEME_POOL_MINIMUM - 1)).toBe('low')
  })

  it('returns healthy at or above the named minimum', () => {
    expect(ThemePoolMonitor.evaluate(THEME_POOL_MINIMUM)).toBe('healthy')
    expect(ThemePoolMonitor.evaluate(THEME_POOL_MINIMUM + 1)).toBe('healthy')
  })
})
