import type { QuotaPlan } from './types.js'

export const FREE_CYCLE_ALLOWANCE = 4

export class QuotaPolicy {
  static isEnforced(plan: QuotaPlan): boolean {
    return plan === 'free'
  }

  static allowanceFor(plan: QuotaPlan): number {
    return QuotaPolicy.isEnforced(plan) ? FREE_CYCLE_ALLOWANCE : 0
  }

  static carriedUsageFrom(consumedCount: number): number {
    return Math.min(FREE_CYCLE_ALLOWANCE, Math.max(0, consumedCount))
  }
}

export type { QuotaPlan } from './types.js'
