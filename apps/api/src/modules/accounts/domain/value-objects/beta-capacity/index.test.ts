import { describe, expect, it } from 'vitest'

import { BetaCapacityReachedError } from '@/modules/accounts/domain/errors/beta-capacity-reached-error/index.js'

import { BetaCapacity } from './index.js'

describe('BetaCapacity', () => {
  it('allows reserving the one hundredth beta account', () => {
    expect(() => BetaCapacity.ensureAvailable(99)).not.toThrow()
  })

  it('rejects every reservation after one hundred accounts', () => {
    expect(() => BetaCapacity.ensureAvailable(100)).toThrow(BetaCapacityReachedError)
    expect(() => BetaCapacity.ensureAvailable(101)).toThrow(
      expect.objectContaining({
        code: 'accounts.BETA_CAPACITY_REACHED',
        context: { capacity: 100, accountCount: 101 },
      }),
    )
  })
})
