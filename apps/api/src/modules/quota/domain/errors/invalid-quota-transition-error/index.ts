import type { QuotaReservationStatus } from '@/modules/quota/domain/entities/quota-reservation/types.js'
import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class InvalidQuotaTransitionError extends ConflictError {
  readonly code = 'quota.INVALID_QUOTA_TRANSITION'

  constructor(currentStatus: QuotaReservationStatus, targetStatus: QuotaReservationStatus) {
    super('Quota reservation transition is invalid', { context: { currentStatus, targetStatus } })
  }
}
