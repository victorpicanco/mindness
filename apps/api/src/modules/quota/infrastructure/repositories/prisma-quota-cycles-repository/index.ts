import { Prisma } from '@/generated/prisma/client.js'
import type { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import { QuotaCycleAlreadyOpenError } from '@/modules/quota/domain/errors/quota-cycle-already-open-error/index.js'
import type { QuotaCyclesRepository } from '@/modules/quota/domain/repositories/quota-cycles-repository/index.js'
import type { QuotaCyclesPrismaClient } from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'
import type { QuotaTransactionContext } from '@/modules/quota/infrastructure/clients/quota-transaction-context/index.js'
import type { QuotaCycleMapper } from '@/modules/quota/infrastructure/mappers/quota-cycle-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const UNIQUE_VIOLATION_CODE = 'P2002'
const CYCLE_OPEN_CONSTRAINT = 'quota_cycles_account_id_starts_at_key'

function isCycleAlreadyOpenViolation(
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === UNIQUE_VIOLATION_CODE &&
    error.meta?.target === CYCLE_OPEN_CONSTRAINT
  )
}

export class PrismaQuotaCyclesRepository implements QuotaCyclesRepository {
  constructor(
    private readonly prisma: QuotaCyclesPrismaClient,
    private readonly transactionContext: QuotaTransactionContext,
    private readonly mapper: QuotaCycleMapper,
  ) {}

  async findCurrent(accountId: string, at: Date): Promise<QuotaCycle | null> {
    try {
      const row = await this.client().quotaCycle.findFirst({
        where: { accountId, startsAt: { lte: at }, renewsAt: { gt: at } },
      })
      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to find the current quota cycle', { cause: error })
    }
  }

  async findLatest(accountId: string): Promise<QuotaCycle | null> {
    try {
      const row = await this.client().quotaCycle.findFirst({
        where: { accountId },
        orderBy: { sequence: 'desc' },
      })
      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to find the latest quota cycle', { cause: error })
    }
  }

  async save(cycle: QuotaCycle): Promise<void> {
    const row = this.mapper.toPersistence(cycle)
    try {
      await this.client().quotaCycle.create({ data: row })
    } catch (error) {
      if (isCycleAlreadyOpenViolation(error)) {
        throw new QuotaCycleAlreadyOpenError(row.accountId, row.startsAt, { cause: error })
      }
      throw new DatabaseError('Failed to save the quota cycle', {
        cause: error,
        context: { accountId: row.accountId },
      })
    }
  }

  private client(): QuotaCyclesPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
