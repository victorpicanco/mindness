import { Prisma } from '@/generated/prisma/client.js'
import type { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionAlreadyRunningError } from '@/modules/sessions/domain/errors/session-already-running-error/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { SessionsPrismaClient } from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'
import type { SessionsTransactionContext } from '@/modules/sessions/infrastructure/clients/sessions-transaction-context/index.js'
import type { SessionMapper } from '@/modules/sessions/infrastructure/mappers/session-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

const UNIQUE_VIOLATION_CODE = 'P2002'
const ACTIVE_SESSION_INDEX = 'sessions_account_id_active_key'

function isInProgressUniquenessViolation(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false
  if (error.code !== UNIQUE_VIOLATION_CODE) return false

  return JSON.stringify(error.meta ?? {}).includes(ACTIVE_SESSION_INDEX)
}

export class PrismaSessionsRepository implements SessionsRepository {
  constructor(
    private readonly prisma: SessionsPrismaClient,
    private readonly transactionContext: SessionsTransactionContext,
    private readonly mapper: SessionMapper,
  ) {}

  async findById(sessionId: string): Promise<Session | null> {
    try {
      const row = await this.client().session.findUnique({
        where: { id: sessionId },
        include: { audio: true },
      })

      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to find the session', {
        cause: error,
        context: { sessionId },
      })
    }
  }

  async findActiveByAccountId(accountId: string): Promise<Session | null> {
    try {
      const row = await this.client().session.findFirst({
        where: { accountId, state: 'in_progress' },
        include: { audio: true },
      })

      return row === null ? null : this.mapper.toDomain(row)
    } catch (error) {
      throw new DatabaseError('Failed to find the active session', {
        cause: error,
        context: { accountId },
      })
    }
  }

  async listByAccount(input: {
    readonly accountId: string
    readonly limit: number
    readonly cursor: string | null
  }): Promise<Session[]> {
    try {
      const rows = await this.client().session.findMany({
        where: { accountId: input.accountId, state: { not: 'deleted' } },
        include: { audio: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: input.limit,
        ...(input.cursor === null ? {} : { cursor: { id: input.cursor }, skip: 1 }),
      })

      return rows.map((row) => this.mapper.toDomain(row))
    } catch (error) {
      throw new DatabaseError('Failed to list sessions for the account', {
        cause: error,
        context: { accountId: input.accountId, limit: input.limit },
      })
    }
  }

  async findCompletedBetween(accountId: string, from: Date, to: Date): Promise<Session[]> {
    try {
      const rows = await this.client().session.findMany({
        where: { accountId, state: 'completed', createdAt: { gte: from, lte: to } },
        include: { audio: true },
      })

      return rows.map((row) => this.mapper.toDomain(row))
    } catch (error) {
      throw new DatabaseError('Failed to find completed sessions in the time window', {
        cause: error,
        context: { accountId, from: from.toISOString(), to: to.toISOString() },
      })
    }
  }

  async findExpiredInProgress(before: Date, limit: number): Promise<Session[]> {
    try {
      const rows = await this.client().session.findMany({
        where: { state: 'in_progress', expiresAt: { lte: before } },
        include: { audio: true },
        take: limit,
      })

      return rows.map((row) => this.mapper.toDomain(row))
    } catch (error) {
      throw new DatabaseError('Failed to find expired sessions', {
        cause: error,
        context: { before: before.toISOString(), limit },
      })
    }
  }

  async findStuckProcessing(before: Date, limit: number): Promise<Session[]> {
    try {
      const rows = await this.client().session.findMany({
        where: { state: 'processing', recordedAt: { lte: before } },
        include: { audio: true },
        take: limit,
      })

      return rows.map((row) => this.mapper.toDomain(row))
    } catch (error) {
      throw new DatabaseError('Failed to find sessions stuck in processing', {
        cause: error,
        context: { before: before.toISOString(), limit },
      })
    }
  }

  // The deletion is a compare-and-set instead of a plain save so that two concurrent requests
  // produce one `session_deleted`; the loser sees `false` and reports the session as gone.
  async markDeleted(session: Session): Promise<boolean> {
    const deletedAt = session.deletedAt
    if (deletedAt === null) {
      throw new DatabaseError('Refused to persist a deletion without a deletion instant', {
        context: { sessionId: session.id, state: session.state },
      })
    }

    try {
      const { count } = await this.client().session.updateMany({
        where: { id: session.id, state: { not: 'deleted' } },
        data: { state: 'deleted', deletedAt },
      })

      return count === 1
    } catch (error) {
      throw new DatabaseError('Failed to mark the session as deleted', {
        cause: error,
        context: { sessionId: session.id },
      })
    }
  }

  async save(session: Session): Promise<void> {
    try {
      await this.client().session.upsert({
        where: { id: session.id },
        create: this.mapper.toCreateData(session),
        update: this.mapper.toUpdateData(session),
      })
    } catch (error) {
      // LAW-004.6: the partial unique index that keeps one in-progress session per account
      // has a domain meaning, so the technology error is translated rather than propagated.
      if (isInProgressUniquenessViolation(error)) {
        throw new SessionAlreadyRunningError(session.id)
      }

      throw new DatabaseError('Failed to save the session', {
        cause: error,
        context: { sessionId: session.id },
      })
    }
  }

  private client(): SessionsPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
