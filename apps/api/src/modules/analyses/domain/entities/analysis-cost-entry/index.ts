export interface AnalysisCostEntry {
  readonly id: string
  readonly sessionId: string
  readonly accountId: string
  readonly transcriptionMicrosUsd: number
  readonly evaluationMicrosUsd: number
  readonly auditoryMicrosUsd: number
  readonly synthesisMicrosUsd: number
  readonly totalMicrosUsd: number
  readonly incurredAt: Date
}
