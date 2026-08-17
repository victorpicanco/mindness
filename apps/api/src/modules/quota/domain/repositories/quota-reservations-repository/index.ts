import type { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'

export interface QuotaReservationCounts {
  readonly held: number
  readonly consumed: number
}

export interface QuotaReservationsRepository {
  findBySessionId(sessionId: string): Promise<QuotaReservation | null>
  countByCycle(cycleId: string): Promise<QuotaReservationCounts>
  countConsumedSince(accountId: string, since: Date): Promise<number>
  save(reservation: QuotaReservation): Promise<void>
}
