export interface TranscriptionRow {
  readonly id: string
  readonly sessionId: string
  readonly text: string
  readonly words: unknown
  readonly averageConfidence: number
  readonly durationSeconds: number
  readonly createdAt: Date
}

export interface AnalysisRow {
  readonly id: string
  readonly sessionId: string
  readonly clarityScore: number
  readonly rhythmScore: number
  readonly fluencyScore: number
  readonly masteryScore: number
  readonly totalScore: number
  readonly guidance: unknown
  readonly rhythmMetrics: unknown
  readonly processingMs: number
  readonly costMicrosUsd: number
  readonly createdAt: Date
}

export interface AnalysisCostEntryRow {
  readonly id: string
  readonly sessionId: string
  readonly accountId: string
  readonly transcriptionMicrosUsd: number
  readonly evaluationMicrosUsd: number
  readonly totalMicrosUsd: number
  readonly incurredAt: Date
}

export interface AnalysesPrismaClient {
  readonly transcription: {
    findUnique(args: {
      readonly where: { readonly sessionId: string }
    }): Promise<TranscriptionRow | null>
    upsert(args: {
      readonly where: { readonly sessionId: string }
      readonly create: TranscriptionRow
      readonly update: TranscriptionRow
    }): Promise<TranscriptionRow>
  }
  readonly analysis: {
    findUnique(args: {
      readonly where: { readonly sessionId: string }
    }): Promise<AnalysisRow | null>
    upsert(args: {
      readonly where: { readonly sessionId: string }
      readonly create: AnalysisRow
      readonly update: AnalysisRow
    }): Promise<AnalysisRow>
  }
  readonly analysisCostEntry: {
    create(args: { readonly data: AnalysisCostEntryRow }): Promise<AnalysisCostEntryRow>
    aggregate(args: {
      readonly _sum: { readonly totalMicrosUsd: true }
      readonly where: { readonly incurredAt: { readonly gte: Date; readonly lt: Date } }
    }): Promise<{ readonly _sum: { readonly totalMicrosUsd: number | null } }>
  }
}

export interface AnalysesPrismaTransactionRunner {
  $transaction<T>(
    operation: (transaction: AnalysesPrismaClient) => Promise<T>,
    options: { readonly isolationLevel: 'Serializable' },
  ): Promise<T>
}
