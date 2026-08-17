import { describe, expect, it } from 'vitest'

import { InvalidQuotaValueError } from '@/modules/quota/domain/errors/invalid-quota-value-error/index.js'

import { CYCLE_LENGTH_DAYS, CycleWindow } from './index.js'

const STARTS_AT = new Date('2026-08-17T12:00:00.000Z')
const CYCLE_LENGTH_MILLISECONDS = CYCLE_LENGTH_DAYS * 24 * 60 * 60 * 1000

describe('CycleWindow', () => {
  it('starts at the supplied instant and lasts thirty days', () => {
    const window = CycleWindow.create(STARTS_AT)

    expect(window.startsAt).toEqual(STARTS_AT)
    expect(window.renewsAt).toEqual(new Date(STARTS_AT.getTime() + CYCLE_LENGTH_MILLISECONDS))
  })

  it('contains its starting instant but not its renewal instant', () => {
    const window = CycleWindow.create(STARTS_AT)

    expect(window.contains(STARTS_AT)).toBe(true)
    expect(window.contains(window.renewsAt)).toBe(false)
  })

  it('advances in complete thirty-day windows', () => {
    const window = CycleWindow.create(STARTS_AT)
    const instantSixtyOneDaysLater = new Date(STARTS_AT.getTime() + 61 * 24 * 60 * 60 * 1000)

    const advancedWindow = window.advanceTo(instantSixtyOneDaysLater)

    expect(advancedWindow.startsAt).toEqual(
      new Date(STARTS_AT.getTime() + 60 * 24 * 60 * 60 * 1000),
    )
    expect(advancedWindow.contains(instantSixtyOneDaysLater)).toBe(true)
  })

  it('returns an equal window when advancing to an instant it already contains', () => {
    const window = CycleWindow.create(STARTS_AT)
    const instantWithinWindow = new Date(STARTS_AT.getTime() + 12 * 60 * 60 * 1000)

    expect(window.advanceTo(instantWithinWindow).equals(window)).toBe(true)
  })

  it('never moves backwards when advancing to an instant before it started', () => {
    const window = CycleWindow.create(STARTS_AT)
    const instantBeforeStart = new Date(STARTS_AT.getTime() - CYCLE_LENGTH_MILLISECONDS)

    expect(window.advanceTo(instantBeforeStart).equals(window)).toBe(true)
  })

  it('rejects an unusable starting instant', () => {
    expect(() => CycleWindow.create(new Date('not-a-date'))).toThrow(InvalidQuotaValueError)
  })

  it('reconstitutes a persisted window from both of its instants', () => {
    const renewsAt = new Date(STARTS_AT.getTime() + CYCLE_LENGTH_MILLISECONDS)
    const window = CycleWindow.reconstitute(STARTS_AT, renewsAt)

    expect(window.startsAt).toEqual(STARTS_AT)
    expect(window.renewsAt).toEqual(renewsAt)
  })

  it('compares windows by value', () => {
    const window = CycleWindow.create(STARTS_AT)

    expect(window.equals(CycleWindow.create(STARTS_AT))).toBe(true)
    expect(window.equals(CycleWindow.create(new Date(STARTS_AT.getTime() + 1)))).toBe(false)
  })

  it('does not expose its dates by alias', () => {
    const window = CycleWindow.create(STARTS_AT)
    const startsAt = window.startsAt
    const renewsAt = window.renewsAt

    startsAt.setUTCFullYear(2000)
    renewsAt.setUTCFullYear(2000)

    expect(window.startsAt).toEqual(STARTS_AT)
    expect(window.renewsAt).toEqual(new Date(STARTS_AT.getTime() + CYCLE_LENGTH_MILLISECONDS))
    expect(window.startsAt).not.toBe(startsAt)
    expect(window.renewsAt).not.toBe(renewsAt)
  })
})
