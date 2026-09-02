import type { SpeechFeedback } from '@/modules/analyses/domain/ports/evaluation-port/index.js'

export interface CreateAnalysisParams {
  readonly analysisId: string
  readonly sessionId: string
  readonly feedback: SpeechFeedback
  readonly processingMs: number
  readonly costMicrosUsd: number
  readonly createdAt: Date
}

export type ReconstituteAnalysisParams = CreateAnalysisParams
