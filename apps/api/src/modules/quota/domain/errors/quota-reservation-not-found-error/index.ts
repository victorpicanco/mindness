import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class QuotaReservationNotFoundError extends NotFoundError {
  readonly code = 'quota.QUOTA_RESERVATION_NOT_FOUND'

  constructor(sessionId: string) {
    super('Quota reservation not found', { context: { sessionId } })
  }
}
