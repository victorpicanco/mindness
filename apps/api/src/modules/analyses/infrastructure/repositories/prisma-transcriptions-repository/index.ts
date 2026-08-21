import type { Transcription } from '@/modules/analyses/domain/entities/transcription/index.js'
import type { TranscriptionsRepository } from '@/modules/analyses/domain/repositories/transcriptions-repository/index.js'
import type { AnalysesPrismaClient } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import type { AnalysesTransactionContext } from '@/modules/analyses/infrastructure/clients/analyses-transaction-context/index.js'
import type { TranscriptionMapper } from '@/modules/analyses/infrastructure/mappers/transcription-mapper/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

export class PrismaTranscriptionsRepository implements TranscriptionsRepository {
  constructor(
    private readonly prisma: AnalysesPrismaClient,
    private readonly context: AnalysesTransactionContext,
    private readonly mapper: TranscriptionMapper,
  ) {}
  async findBySessionId(sessionId: string): Promise<Transcription | null> {
    try {
      const row = await this.client().transcription.findUnique({ where: { sessionId } })
      return row === null ? null : this.mapper.toDomain(row)
    } catch (cause) {
      throw new DatabaseError('Failed to find transcription', { cause, context: { sessionId } })
    }
  }
  async save(transcription: Transcription): Promise<void> {
    try {
      const data = this.mapper.toData(transcription)
      await this.client().transcription.upsert({
        where: { id: transcription.id },
        create: data,
        update: data,
      })
    } catch (cause) {
      throw new DatabaseError('Failed to save transcription', {
        cause,
        context: { sessionId: transcription.sessionId },
      })
    }
  }
  private client(): AnalysesPrismaClient {
    return this.context.current() ?? this.prisma
  }
}
