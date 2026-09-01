import type { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'

export interface CreateCommunicationAnalysisParams {
  readonly analysisId: string
  readonly sessionId: string
  readonly promptVersion: string
  readonly feedback: CommunicationFeedback
  readonly processingMs: number
  readonly costMicrosUsd: number
  readonly createdAt: Date
}

export interface ReconstituteCommunicationAnalysisParams extends CreateCommunicationAnalysisParams {
  readonly feedbackVersion: number
}
