export interface AnalysisCostEntry {
  readonly id: string
  readonly sessionId: string
  readonly accountId: string
  readonly transcriptionMicrosUsd: number
  readonly evaluationMicrosUsd: number
  readonly totalMicrosUsd: number
  readonly incurredAt: Date
}

export interface AnalysisCostEntriesRepository {
  save(entry: AnalysisCostEntry): Promise<void>
  sumMicrosBetween(from: Date, to: Date): Promise<number>
}
