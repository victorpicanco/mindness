import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'

export interface ConsumeQuotaReservationInput {
  readonly sessionId: string
}

export interface ConsumeQuotaReservationDependencies {
  readonly clock: Clock
  readonly quotaReservations: QuotaReservationsRepository
  readonly unitOfWork: UnitOfWork
}
