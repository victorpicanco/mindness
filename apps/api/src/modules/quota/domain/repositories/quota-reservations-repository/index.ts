import type { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import type { QuotaReservationCounts } from '@/modules/quota/domain/entities/quota-reservation/types.js'

export interface QuotaReservationsRepository {
  findBySessionId(sessionId: string): Promise<QuotaReservation | null>
  countByCycle(cycleId: string): Promise<QuotaReservationCounts>
  countConsumedSince(accountId: string, since: Date): Promise<number>
  save(reservation: QuotaReservation): Promise<void>
}
