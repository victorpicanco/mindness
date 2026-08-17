import { describe, expect, it } from 'vitest'

import { FREE_CYCLE_ALLOWANCE, QuotaPolicy } from './index.js'

describe('QuotaPolicy', () => {
  it('enforces quota only for free accounts', () => {
    expect(QuotaPolicy.isEnforced('free')).toBe(true)
    expect(QuotaPolicy.isEnforced('plus')).toBe(false)
  })

  it('returns the free cycle allowance', () => {
    expect(FREE_CYCLE_ALLOWANCE).toBe(4)
    expect(QuotaPolicy.allowanceFor('free')).toBe(FREE_CYCLE_ALLOWANCE)
  })

  it('saturates carried usage at the allowance and zero', () => {
    expect(QuotaPolicy.carriedUsageFrom(12)).toBe(FREE_CYCLE_ALLOWANCE)
    expect(QuotaPolicy.carriedUsageFrom(-1)).toBe(0)
  })
})
