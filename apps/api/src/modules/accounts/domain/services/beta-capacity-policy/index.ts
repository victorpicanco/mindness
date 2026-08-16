import { BetaCapacityReachedError } from '@/modules/accounts/domain/errors/beta-capacity-reached-error/index.js'

const BETA_CAPACITY = 100

export class BetaCapacityPolicy {
  static ensureAvailable(accountCount: number): void {
    if (accountCount >= BETA_CAPACITY) throw new BetaCapacityReachedError(accountCount)
  }
}
