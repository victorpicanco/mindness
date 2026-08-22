import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ANALYSIS_TIMEOUT = 'analysis_timeout'
const ANALYSIS_TIMEOUT_VERSION = 1

export interface AnalysisTimedOutPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly plan: AccountPlan
}

export interface CreateAnalysisTimedOutParams extends AnalysisTimedOutPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class AnalysisTimedOut implements IntegrationEvent<
  typeof ANALYSIS_TIMEOUT,
  AnalysisTimedOutPayload
> {
  readonly eventName = ANALYSIS_TIMEOUT
  readonly version = ANALYSIS_TIMEOUT_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: AnalysisTimedOutPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateAnalysisTimedOutParams): AnalysisTimedOut {
    const payload = Object.freeze({
      sessionId: params.sessionId,
      accountId: params.accountId,
      plan: params.plan,
    })

    return new AnalysisTimedOut(params.eventId, params.occurredAt.getTime(), payload)
  }
}
