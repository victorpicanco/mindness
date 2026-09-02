import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ANALYSIS_COMPLETED = 'analysis_completed'
const ANALYSIS_COMPLETED_VERSION = 1

export interface AnalysisCompletedPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly plan: AccountPlan
  readonly processingMs: number
  readonly costMicrosUsd: number
}

export interface CreateAnalysisCompletedParams extends AnalysisCompletedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class AnalysisCompleted implements IntegrationEvent<
  typeof ANALYSIS_COMPLETED,
  AnalysisCompletedPayload
> {
  readonly eventName = ANALYSIS_COMPLETED
  readonly version = ANALYSIS_COMPLETED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: AnalysisCompletedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateAnalysisCompletedParams): AnalysisCompleted {
    return new AnalysisCompleted(
      params.eventId,
      params.occurredAt.getTime(),
      Object.freeze({
        sessionId: params.sessionId,
        accountId: params.accountId,
        plan: params.plan,
        processingMs: params.processingMs,
        costMicrosUsd: params.costMicrosUsd,
      }),
    )
  }
}
