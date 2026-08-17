import { InvalidQuotaValueError } from '@/modules/quota/domain/errors/invalid-quota-value-error/index.js'

import type { QuotaPlan } from './types.js'

export const FREE_CYCLE_ALLOWANCE = 4

export class QuotaPolicy {
  static isEnforced(plan: QuotaPlan): boolean {
    return plan === 'free'
  }

  static allowanceFor(plan: QuotaPlan): number {
    if (!QuotaPolicy.isEnforced(plan)) {
      throw new InvalidQuotaValueError('plan')
    }

    return FREE_CYCLE_ALLOWANCE
  }

  static carriedUsageFrom(consumedCount: number, allowance: number): number {
    return Math.min(allowance, Math.max(0, consumedCount))
  }
}

export type { QuotaPlan } from './types.js'
