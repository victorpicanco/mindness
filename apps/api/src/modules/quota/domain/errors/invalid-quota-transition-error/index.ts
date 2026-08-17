import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class InvalidQuotaTransitionError extends ConflictError {
  readonly code = 'quota.INVALID_QUOTA_TRANSITION'

  constructor(currentStatus: string, targetStatus: string) {
    super('Quota reservation transition is invalid', { context: { currentStatus, targetStatus } })
  }
}
