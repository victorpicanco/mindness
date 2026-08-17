import { describe, expect, it } from 'vitest'

import { InvalidQuotaValueError } from '@/modules/quota/domain/errors/invalid-quota-value-error/index.js'

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

  it('refuses an allowance for a plan it does not enforce', () => {
    expect(() => QuotaPolicy.allowanceFor('plus')).toThrow(InvalidQuotaValueError)
  })

  it('saturates carried usage at the given allowance and zero', () => {
    expect(QuotaPolicy.carriedUsageFrom(12, FREE_CYCLE_ALLOWANCE)).toBe(FREE_CYCLE_ALLOWANCE)
    expect(QuotaPolicy.carriedUsageFrom(2, FREE_CYCLE_ALLOWANCE)).toBe(2)
    expect(QuotaPolicy.carriedUsageFrom(-1, FREE_CYCLE_ALLOWANCE)).toBe(0)
    expect(QuotaPolicy.carriedUsageFrom(12, 2)).toBe(2)
  })
})
