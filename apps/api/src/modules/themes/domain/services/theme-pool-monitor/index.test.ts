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

  it('creates a low-pool event when the pool is not healthy', () => {
    const occurredAt = new Date('2026-08-16T12:00:00.000Z')

    expect(
      ThemePoolMonitor.createLowAlert({
        eventId: 'event-1',
        occurredAt,
        categorySlug: 'reflection',
        difficulty: 'balanced',
        publishedCount: THEME_POOL_MINIMUM - 1,
      }),
    ).toMatchObject({
      eventName: 'theme_pool_low',
      eventId: 'event-1',
      occurredAt,
      payload: {
        categorySlug: 'reflection',
        difficulty: 'balanced',
        publishedCount: THEME_POOL_MINIMUM - 1,
        minimum: THEME_POOL_MINIMUM,
      },
    })
  })

  it('does not create a low-pool event for a healthy pool', () => {
    expect(
      ThemePoolMonitor.createLowAlert({
        eventId: 'event-1',
        occurredAt: new Date('2026-08-16T12:00:00.000Z'),
        categorySlug: 'reflection',
        difficulty: 'balanced',
        publishedCount: THEME_POOL_MINIMUM,
      }),
    ).toBeNull()
  })
})
