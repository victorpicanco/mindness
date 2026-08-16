import { describe, expect, it } from 'vitest'

import { ThemePoolLow } from './index.js'

describe('ThemePoolLow', () => {
  it('preserves its event contract and timestamp value', () => {
    const occurredAt = new Date('2026-08-16T12:00:00.000Z')
    const event = ThemePoolLow.create({
      eventId: 'event-1',
      occurredAt,
      categorySlug: 'mindfulness',
      difficulty: 'easy',
      publishedCount: 9,
      minimum: 10,
    })

    expect(event).toMatchObject({
      eventId: 'event-1',
      eventName: 'theme_pool_low',
      version: 1,
      payload: { categorySlug: 'mindfulness', difficulty: 'easy', publishedCount: 9, minimum: 10 },
    })
    expect(event.occurredAt).toEqual(occurredAt)
    expect(event.occurredAt).not.toBe(occurredAt)
  })
})
