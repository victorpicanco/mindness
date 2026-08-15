import { describe, expect, it } from 'vitest'

import { ControllableClock } from './index.js'

describe('ControllableClock', () => {
  it('returns the fixed date passed at construction', () => {
    const fixed = new Date('2026-01-01T00:00:00.000Z')
    const clock = new ControllableClock(fixed)

    expect(clock.now()).toEqual(fixed)
  })

  it('advances by the given number of milliseconds', () => {
    const clock = new ControllableClock(new Date('2026-01-01T00:00:00.000Z'))

    clock.advance(60_000)

    expect(clock.now()).toEqual(new Date('2026-01-01T00:01:00.000Z'))
  })

  it('fixes the clock to an explicit date via set', () => {
    const clock = new ControllableClock(new Date('2026-01-01T00:00:00.000Z'))
    const target = new Date('2030-06-15T12:00:00.000Z')

    clock.set(target)

    expect(clock.now()).toEqual(target)
  })
})
