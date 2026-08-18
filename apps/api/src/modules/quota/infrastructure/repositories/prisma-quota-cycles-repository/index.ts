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
const CYCLE_OPEN_FIELDS = ['account_id', 'starts_at']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function violatedConstraint(error: Prisma.PrismaClientKnownRequestError): unknown {
  const meta: unknown = error.meta
  if (!isRecord(meta) || !isRecord(meta.driverAdapterError)) return undefined

  const cause = meta.driverAdapterError.cause

  return isRecord(cause) ? cause.constraint : undefined
}

function isCycleAlreadyOpenViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== UNIQUE_VIOLATION_CODE) return false

  const constraint = violatedConstraint(error)
  if (!isRecord(constraint)) return true
  if (constraint.index === CYCLE_OPEN_CONSTRAINT) return true

  const fields: unknown = constraint.fields

  return Array.isArray(fields) && CYCLE_OPEN_FIELDS.every((column) => fields.includes(column))
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
