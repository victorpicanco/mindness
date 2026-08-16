import { describe, expect, it } from 'vitest'

import { ThemePoolLow } from '../theme-pool-low/index.js'
import { ThemeRejected } from './index.js'

describe('ThemeRejected', () => {
  it('carries the canonical integration event envelope', () => {
    const event = ThemeRejected.create({
      eventId: 'generated-event-id',
      occurredAt: new Date('2026-08-16T00:00:00.000Z'),
      title: 'A difficult topic',
      categorySlug: 'reflection',
      difficulty: 'hard',
      issues: [{ field: 'title', reason: 'already used' }],
    })

    expect(event).toMatchObject({
      eventId: 'generated-event-id',
      eventName: 'theme_rejected',
      version: 1,
      occurredAt: new Date('2026-08-16T00:00:00.000Z'),
    })
  })

  it('carries only serializable primitives in its payload', () => {
    const event = ThemeRejected.create({
      eventId: 'generated-event-id',
      occurredAt: new Date('2026-08-16T00:00:00.000Z'),
      title: 'A difficult topic',
      categorySlug: 'reflection',
      difficulty: 'hard',
      issues: [{ field: 'title', reason: 'already used' }],
    })

    expect(event.payload).toEqual({
      title: 'A difficult topic',
      categorySlug: 'reflection',
      difficulty: 'hard',
      issues: [{ field: 'title', reason: 'already used' }],
    })
    expect(JSON.parse(JSON.stringify(event.payload))).toEqual(event.payload)
  })

  it('does not retain or expose a mutable occurrence instant', () => {
    const input = new Date('2026-08-16T00:00:00.000Z')
    const event = ThemeRejected.create({
      eventId: 'generated-event-id',
      occurredAt: input,
      title: 'A difficult topic',
      categorySlug: 'reflection',
      difficulty: 'hard',
      issues: [{ field: 'title', reason: 'already used' }],
    })
    input.setTime(0)
    const exposed = event.occurredAt
    exposed.setTime(0)

    expect(event.occurredAt).toEqual(new Date('2026-08-16T00:00:00.000Z'))
  })
})

describe('ThemePoolLow', () => {
  it('carries the catalog pool alert payload', () => {
    const event = ThemePoolLow.create({
      eventId: 'generated-event-id',
      occurredAt: new Date('2026-08-16T00:00:00.000Z'),
      categorySlug: 'reflection',
      difficulty: 'hard',
      publishedCount: 9,
      minimum: 10,
    })

    expect(event).toMatchObject({
      eventId: 'generated-event-id',
      eventName: 'theme_pool_low',
      version: 1,
      occurredAt: new Date('2026-08-16T00:00:00.000Z'),
      payload: {
        categorySlug: 'reflection',
        difficulty: 'hard',
        publishedCount: 9,
        minimum: 10,
      },
    })
    expect(JSON.parse(JSON.stringify(event.payload))).toEqual(event.payload)
  })
})
