import type { Session } from '@/modules/sessions/domain/entities/session/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type {
  SessionCreateData,
  SessionRow,
  SessionsPrismaClient,
  SessionUpdateData,
} from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'
import type { SessionsTransactionContext } from '@/modules/sessions/infrastructure/clients/sessions-transaction-context/index.js'
import type { SessionMapper } from '@/modules/sessions/infrastructure/mappers/session-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

function toCreateData(row: SessionRow): SessionCreateData {
  const audio = row.audio

  return {
    id: row.id,
    accountId: row.accountId,
    themeId: row.themeId,
    difficulty: row.difficulty,
    categorySlug: row.categorySlug,
    searchWindowMinutes: row.searchWindowMinutes,
    quotaReservationId: row.quotaReservationId,
    state: row.state,
    expiredReason: row.expiredReason,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    expiredAt: row.expiredAt,
    ...(audio === undefined || audio === null
      ? {}
      : {
          audio: {
            create: {
              id: audio.id,
              durationSeconds: audio.durationSeconds,
              sizeBytes: audio.sizeBytes,
              contentType: audio.contentType,
              storagePath: audio.storagePath,
              createdAt: audio.createdAt,
            },
          },
        }),
  }
}

function toUpdateData(row: SessionRow): SessionUpdateData {
  const audio = row.audio

  return {
    id: row.id,
    accountId: row.accountId,
    themeId: row.themeId,
    difficulty: row.difficulty,
    categorySlug: row.categorySlug,
    searchWindowMinutes: row.searchWindowMinutes,
    quotaReservationId: row.quotaReservationId,
    state: row.state,
    expiredReason: row.expiredReason,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    expiredAt: row.expiredAt,
    ...(audio === undefined || audio === null
      ? {}
      : {
          audio: {
            upsert: {
              create: {
                id: audio.id,
                durationSeconds: audio.durationSeconds,
                sizeBytes: audio.sizeBytes,
                contentType: audio.contentType,
                storagePath: audio.storagePath,
                createdAt: audio.createdAt,
              },
              update: {
                durationSeconds: audio.durationSeconds,
                sizeBytes: audio.sizeBytes,
                contentType: audio.contentType,
                storagePath: audio.storagePath,
              },
            },
          },
        }),
  }
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

  async save(session: Session): Promise<void> {
    const row = this.mapper.toPersistence(session)

    try {
      await this.client().session.upsert({
        where: { id: row.id },
        create: toCreateData(row),
        update: toUpdateData(row),
      })
    } catch (error) {
      throw new DatabaseError('Failed to save the session', {
        cause: error,
        context: { sessionId: row.id },
      })
    }
  }

  private client(): SessionsPrismaClient {
    return this.transactionContext.current() ?? this.prisma
  }
}
