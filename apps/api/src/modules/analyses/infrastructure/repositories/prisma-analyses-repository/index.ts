import type { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type { AnalysesRepository } from '@/modules/analyses/domain/repositories/analyses-repository/index.js'
import type { AnalysesPrismaClient } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import type { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import type { AnalysisMapper } from '@/modules/analyses/infrastructure/mappers/analysis-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

export class PrismaAnalysesRepository implements AnalysesRepository {
  constructor(
    private readonly prisma: AnalysesPrismaClient,
    private readonly context: AnalysesTransactionContext,
    private readonly mapper: AnalysisMapper,
  ) {}

  async findBySessionId(sessionId: string): Promise<Analysis | null> {
    try {
      const row = await this.client().analysis.findUnique({ where: { sessionId } })
      return row === null ? null : this.mapper.toDomain(row)
    } catch (cause) {
      throw new DatabaseError('Failed to find analysis', { cause, context: { sessionId } })
    }
  }

  async save(analysis: Analysis): Promise<void> {
    try {
      const data = this.mapper.toData(analysis)
      await this.client().analysis.upsert({
        where: { sessionId: analysis.sessionId },
        create: data,
        update: data,
      })
    } catch (cause) {
      throw new DatabaseError('Failed to save analysis', {
        cause,
        context: { sessionId: analysis.sessionId },
      })
    }
  }

  async markFirstView(sessionId: string, at: Date): Promise<boolean> {
    try {
      const { count } = await this.client().analysis.updateMany({
        where: { sessionId, viewedAt: null },
        data: { viewedAt: at },
      })
      return count === 1
    } catch (cause) {
      throw new DatabaseError('Failed to mark the first analysis view', {
        cause,
        context: { sessionId },
      })
    }
  }

  private client(): AnalysesPrismaClient {
    return this.context.current() ?? this.prisma
  }
}
