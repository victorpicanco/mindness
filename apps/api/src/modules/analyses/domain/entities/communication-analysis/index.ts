import { InvalidCommunicationAnalysisError } from '@/modules/analyses/domain/errors/invalid-communication-analysis-error/index.js'
import type { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'

import type {
  CreateCommunicationAnalysisParams,
  ReconstituteCommunicationAnalysisParams,
} from './types.js'

export const COMMUNICATION_FEEDBACK_VERSION = 2
export const SPEECH_FEEDBACK_PROMPT_VERSION = 'speech-feedback-v1'

export class CommunicationAnalysis {
  readonly feedbackVersion = COMMUNICATION_FEEDBACK_VERSION

  private constructor(
    readonly id: string,
    readonly sessionId: string,
    readonly promptVersion: string,
    readonly feedback: CommunicationFeedback,
    readonly processingMs: number,
    readonly costMicrosUsd: number,
    private readonly createdAtEpoch: number,
  ) {}

  get createdAt(): Date {
    return new Date(this.createdAtEpoch)
  }

  static create(params: CreateCommunicationAnalysisParams): CommunicationAnalysis {
    return CommunicationAnalysis.fromParams(params)
  }

  static reconstitute(params: ReconstituteCommunicationAnalysisParams): CommunicationAnalysis {
    if (params.feedbackVersion !== COMMUNICATION_FEEDBACK_VERSION) {
      throw new InvalidCommunicationAnalysisError('feedbackVersion')
    }

    return CommunicationAnalysis.fromParams(params)
  }

  private static fromParams(params: CreateCommunicationAnalysisParams): CommunicationAnalysis {
    if (params.promptVersion.trim().length === 0) {
      throw new InvalidCommunicationAnalysisError('promptVersion')
    }

    requireNonNegativeInteger(params.processingMs, 'processingMs')
    requireNonNegativeInteger(params.costMicrosUsd, 'costMicrosUsd')

    return new CommunicationAnalysis(
      params.analysisId,
      params.sessionId,
      params.promptVersion,
      params.feedback,
      params.processingMs,
      params.costMicrosUsd,
      params.createdAt.getTime(),
    )
  }
}

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new InvalidCommunicationAnalysisError(field)
  }
}

export type {
  CreateCommunicationAnalysisParams,
  ReconstituteCommunicationAnalysisParams,
} from './types.js'
