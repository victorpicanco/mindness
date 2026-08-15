import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class BetaCapacityReachedError extends ConflictError {
  readonly code = 'accounts.BETA_CAPACITY_REACHED'

  constructor(accountCount: number) {
    super('The beta has reached 100 accounts', {
      context: { capacity: 100, accountCount },
    })
  }
}
