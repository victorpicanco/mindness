import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ANALYSIS_VIEWED = 'analysis_viewed'
const ANALYSIS_VIEWED_VERSION = 1

export interface AnalysisViewedPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly plan: AccountPlan
}

export interface CreateAnalysisViewedParams extends AnalysisViewedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class AnalysisViewed implements IntegrationEvent<
  typeof ANALYSIS_VIEWED,
  AnalysisViewedPayload
> {
  readonly eventName = ANALYSIS_VIEWED
  readonly version = ANALYSIS_VIEWED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: AnalysisViewedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateAnalysisViewedParams): AnalysisViewed {
    return new AnalysisViewed(
      params.eventId,
      params.occurredAt.getTime(),
      Object.freeze({
        sessionId: params.sessionId,
        accountId: params.accountId,
        plan: params.plan,
      }),
    )
  }
}
