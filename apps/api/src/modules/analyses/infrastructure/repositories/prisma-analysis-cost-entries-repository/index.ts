import type { AnalysisCostEntry } from '@/modules/analyses/domain/entities/analysis-cost-entry/index.js'
import type { AnalysisCostEntriesRepository } from '@/modules/analyses/domain/repositories/analysis-cost-entries-repository/index.js'
import type { AnalysesPrismaClient } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import type { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import type { AnalysisCostEntryMapper } from '@/modules/analyses/infrastructure/mappers/analysis-cost-entry-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

export class PrismaAnalysisCostEntriesRepository implements AnalysisCostEntriesRepository {
  constructor(
    private readonly prisma: AnalysesPrismaClient,
    private readonly context: AnalysesTransactionContext,
    private readonly mapper: AnalysisCostEntryMapper,
  ) {}

  async save(entry: AnalysisCostEntry): Promise<void> {
    try {
      await this.client().analysisCostEntry.create({ data: this.mapper.toData(entry) })
    } catch (cause) {
      throw new DatabaseError('Failed to save analysis cost entry', {
        cause,
        context: { sessionId: entry.sessionId },
      })
    }
  }

  async sumMicrosBetween(from: Date, to: Date): Promise<number> {
    try {
      const result = await this.client().analysisCostEntry.aggregate({
        _sum: { totalMicrosUsd: true },
        where: { incurredAt: { gte: from, lt: to } },
      })
      return result._sum.totalMicrosUsd ?? 0
    } catch (cause) {
      throw new DatabaseError('Failed to sum analysis costs', {
        cause,
        context: { from: from.toISOString(), to: to.toISOString() },
      })
    }
  }

  private client(): AnalysesPrismaClient {
    return this.context.current() ?? this.prisma
  }
}
