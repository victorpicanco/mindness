import type { AnalysisCostEntry } from '@/modules/analyses/domain/repositories/analysis-cost-entries-repository/index.js'
import type { AnalysisCostEntryRow } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'

export class AnalysisCostEntryMapper {
  toData(entry: AnalysisCostEntry): AnalysisCostEntryRow {
    return entry
  }
}
