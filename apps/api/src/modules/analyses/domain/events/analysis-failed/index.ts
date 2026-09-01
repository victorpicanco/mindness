import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ANALYSIS_FAILED = 'analysis_failed'
const ANALYSIS_FAILED_VERSION = 1

export type AnalysisFailureReason =
  | 'transcription_failed'
  | 'evaluation_failed'
  | 'malformed_evaluation'
  | 'monthly_cost_cap_reached'
  | 'audio_preparation_failed'
  | 'auditory_analysis_failed'
  | 'unusable_audio'
  | 'feedback_synthesis_failed'

export interface AnalysisFailedPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly plan: AccountPlan
  readonly reason: AnalysisFailureReason
}

export interface CreateAnalysisFailedParams extends AnalysisFailedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class AnalysisFailed implements IntegrationEvent<
  typeof ANALYSIS_FAILED,
  AnalysisFailedPayload
> {
  readonly eventName = ANALYSIS_FAILED
  readonly version = ANALYSIS_FAILED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: AnalysisFailedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateAnalysisFailedParams): AnalysisFailed {
    const payload = Object.freeze({
      sessionId: params.sessionId,
      accountId: params.accountId,
      plan: params.plan,
      reason: params.reason,
    })

    return new AnalysisFailed(params.eventId, params.occurredAt.getTime(), payload)
  }
}
