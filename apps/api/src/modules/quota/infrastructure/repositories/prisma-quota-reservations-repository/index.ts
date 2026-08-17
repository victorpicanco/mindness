import type { QuotaReservation } from '@/modules/quota/domain/entities/quota-reservation/index.js'
import type { QuotaReservationCounts } from '@/modules/quota/domain/entities/quota-reservation/types.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'
import type { QuotaReservationsPrismaClient } from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'
import type { QuotaTransactionContext } from '@/modules/quota/infrastructure/clients/quota-transaction-context/index.js'
import type { QuotaReservationMapper } from '@/modules/quota/infrastructure/mappers/quota-reservation-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

export class PrismaQuotaReservationsRepository implements QuotaReservationsRepository {
  constructor(
    private readonly prisma: QuotaReservationsPrismaClient,
    private readonly transactionContext: QuotaTransactionContext,
    private readonly mapper: QuotaReservationMapper,
  ) {}

  async findBySessionId(sessionId: string): Promise<QuotaReservation | null> {
    try {
      const row = await this.client().quotaReservation.findUnique({ where: { sessionId } })
      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to find the quota reservation', { cause: error })
    }
  }

  async findHeldByAccountSince(accountId: string, since: Date): Promise<QuotaReservation[]> {
    try {
      const rows = await this.client().quotaReservation.findMany({
        where: { accountId, status: 'held', createdAt: { gte: since } },
      })
      return rows.map((row) => this.mapper.toDomain(row))
    } catch (error) {
      throw new DatabaseError('Failed to find the held quota reservations', { cause: error })
    }
  }

  async countByCycle(cycleId: string): Promise<QuotaReservationCounts> {
    try {
      const [held, consumed] = await Promise.all([
        this.client().quotaReservation.count({ where: { cycleId, status: 'held' } }),
        this.client().quotaReservation.count({ where: { cycleId, status: 'consumed' } }),
      ])
      return { held, consumed }
    } catch (error) {
      throw new DatabaseError('Failed to count quota reservations', { cause: error })
    }
  }

  async countConsumedSince(accountId: string, since: Date): Promise<number> {
    try {
      return await this.client().quotaReservation.count({
        where: { accountId, status: 'consumed', resolvedAt: { gte: since } },
      })
    } catch (error) {
      throw new DatabaseError('Failed to count consumed quota reservations', { cause: error })
    }
  }

  async save(reservation: QuotaReservation): Promise<void> {
    const row = this.mapper.toPersistence(reservation)
    try {
      await this.client().quotaReservation.upsert({
        where: { id: row.id },
        create: row,
        update: row,
      })
    } catch (error) {
      throw new DatabaseError('Failed to save the quota reservation', {
        cause: error,
        context: { sessionId: row.sessionId },
      })
    }
  }

  private client(): QuotaReservationsPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
