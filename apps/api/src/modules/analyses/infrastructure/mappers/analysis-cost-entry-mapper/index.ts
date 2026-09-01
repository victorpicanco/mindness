import type { AnalysisCostEntry } from '@/modules/analyses/domain/entities/analysis-cost-entry/index.js'
import type { AnalysisCostEntryRow } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'

export class AnalysisCostEntryMapper {
  toData(entry: AnalysisCostEntry): AnalysisCostEntryRow {
    return {
      id: entry.id,
      sessionId: entry.sessionId,
      accountId: entry.accountId,
      transcriptionMicrosUsd: entry.transcriptionMicrosUsd,
      evaluationMicrosUsd: entry.evaluationMicrosUsd,
      auditoryMicrosUsd: entry.auditoryMicrosUsd,
      synthesisMicrosUsd: entry.synthesisMicrosUsd,
      totalMicrosUsd: entry.totalMicrosUsd,
      incurredAt: entry.incurredAt,
    }
  }
}
