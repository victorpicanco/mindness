import { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import type { QuotaReservationRow } from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'

export class QuotaReservationMapper {
  toDomain(row: QuotaReservationRow): QuotaReservation {
    return QuotaReservation.reconstitute({
      id: row.id,
      accountId: row.accountId,
      cycleId: row.cycleId,
      sessionId: row.sessionId,
      status: row.status,
      createdAt: row.createdAt,
      resolvedAt: row.resolvedAt,
    })
  }

  toPersistence(reservation: QuotaReservation): QuotaReservationRow {
    return {
      id: reservation.id,
      accountId: reservation.accountId,
      cycleId: reservation.cycleId,
      sessionId: reservation.sessionId,
      status: reservation.status,
      createdAt: reservation.createdAt,
      resolvedAt: reservation.resolvedAt,
    }
  }
}
