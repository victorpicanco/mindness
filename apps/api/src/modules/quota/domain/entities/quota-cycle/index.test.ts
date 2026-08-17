import { describe, expect, it } from 'vitest'

import { InvalidQuotaValueError } from '@/modules/quota/domain/errors/invalid-quota-value-error/index.js'
import { CycleWindow } from '@/modules/quota/domain/value-objects/cycle-window/index.js'

import { QuotaCycle } from './index.js'

const CREATED_AT = new Date('2026-08-17T12:00:00.000Z')
const WINDOW = CycleWindow.create(CREATED_AT)

describe('QuotaCycle', () => {
  it('creates a cycle with a sequence starting at one', () => {
    const cycle = QuotaCycle.create({
      id: 'cycle-1',
      accountId: 'account-1',
      sequence: 1,
      window: WINDOW,
      allowance: 4,
      carriedUsage: 0,
      createdAt: CREATED_AT,
    })

    expect(cycle.sequence).toBe(1)
    expect(cycle.allowance).toBe(4)
    expect(cycle.carriedUsage).toBe(0)
    expect(cycle.window).toBe(WINDOW)
  })

  it.each([
    ['sequence', 0, 4, 0],
    ['allowance', 1, 0, 0],
    ['carriedUsage above allowance', 1, 4, 5],
    ['negative carriedUsage', 1, 4, -1],
  ])('rejects an invalid %s', (_label, sequence, allowance, carriedUsage) => {
    expect(() =>
      QuotaCycle.create({
        id: 'cycle-1',
        accountId: 'account-1',
        sequence,
        window: WINDOW,
        allowance,
        carriedUsage,
        createdAt: CREATED_AT,
      }),
    ).toThrow(InvalidQuotaValueError)
  })

  it('calculates the remaining balance with a zero floor', () => {
    const cycle = QuotaCycle.create({
      id: 'cycle-1',
      accountId: 'account-1',
      sequence: 1,
      window: WINDOW,
      allowance: 4,
      carriedUsage: 1,
      createdAt: CREATED_AT,
    })

    expect(cycle.remainingFor({ heldCount: 1, consumedCount: 1 })).toBe(1)
    expect(cycle.remainingFor({ heldCount: 2, consumedCount: 2 })).toBe(0)
  })

  it('reports exhaustion from the remaining balance', () => {
    const cycle = QuotaCycle.create({
      id: 'cycle-1',
      accountId: 'account-1',
      sequence: 1,
      window: WINDOW,
      allowance: 4,
      carriedUsage: 1,
      createdAt: CREATED_AT,
    })

    expect(cycle.isExhaustedFor({ heldCount: 1, consumedCount: 1 })).toBe(false)
    expect(cycle.isExhaustedFor({ heldCount: 2, consumedCount: 1 })).toBe(true)
  })
})
