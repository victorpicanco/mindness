import type { CommunicationAnalysis } from '@/modules/analyses/domain/entities/communication-analysis/index.js'
import type { CommunicationAnalysesRepository } from '@/modules/analyses/domain/repositories/communication-analyses-repository/index.js'
import type { AnalysesPrismaClient } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import type { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import type { CommunicationAnalysisMapper } from '@/modules/analyses/infrastructure/mappers/communication-analysis-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

export class PrismaCommunicationAnalysesRepository implements CommunicationAnalysesRepository {
  constructor(
    private readonly prisma: AnalysesPrismaClient,
    private readonly context: AnalysesTransactionContext,
    private readonly mapper: CommunicationAnalysisMapper,
  ) {}

  async findBySessionId(sessionId: string): Promise<CommunicationAnalysis | null> {
    try {
      const row = await this.client().communicationAnalysis.findUnique({ where: { sessionId } })
      return row === null ? null : this.mapper.toDomain(row)
    } catch (cause) {
      throw new DatabaseError('Failed to find the communication analysis', {
        cause,
        context: { sessionId },
      })
    }
  }

  async save(analysis: CommunicationAnalysis): Promise<void> {
    try {
      await this.client().communicationAnalysis.create({ data: this.mapper.toData(analysis) })
    } catch (cause) {
      throw new DatabaseError('Failed to save the communication analysis', {
        cause,
        context: { sessionId: analysis.sessionId },
      })
    }
  }

  private client(): AnalysesPrismaClient {
    return this.context.current() ?? this.prisma
  }
}
