import type { AnalysisCostEntry } from '@/modules/analyses/domain/entities/analysis-cost-entry/index.js'

export interface AnalysisCostEntriesRepository {
  save(entry: AnalysisCostEntry): Promise<void>
  sumMicrosBetween(from: Date, to: Date): Promise<number>
}
