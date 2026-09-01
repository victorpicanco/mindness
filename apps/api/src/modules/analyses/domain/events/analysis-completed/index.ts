import type { AccountPlan } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const ANALYSIS_COMPLETED = 'analysis_completed'
const ANALYSIS_COMPLETED_VERSION = 1

export interface AnalysisScores {
  readonly clarity: number
  readonly rhythm: number
  readonly fluency: number
  readonly mastery: number
  readonly total: number
}

interface AnalysisCompletedBasePayload {
  readonly sessionId: string
  readonly accountId: string
  readonly plan: AccountPlan
  readonly processingMs: number
  readonly costMicrosUsd: number
}

export interface LegacyAnalysisCompletedPayload extends AnalysisCompletedBasePayload {
  readonly analysisVersion: 1
  readonly scores: AnalysisScores
}

export interface MultimodalAnalysisCompletedPayload extends AnalysisCompletedBasePayload {
  readonly analysisVersion: 2
}

export type AnalysisCompletedPayload =
  LegacyAnalysisCompletedPayload | MultimodalAnalysisCompletedPayload

export type CreateAnalysisCompletedParams = AnalysisCompletedPayload & {
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
    const base = {
      sessionId: params.sessionId,
      accountId: params.accountId,
      plan: params.plan,
      processingMs: params.processingMs,
      costMicrosUsd: params.costMicrosUsd,
    }
    const payload: AnalysisCompletedPayload =
      params.analysisVersion === 2
        ? Object.freeze({ ...base, analysisVersion: 2 })
        : Object.freeze({
            ...base,
            analysisVersion: 1,
            scores: Object.freeze({ ...params.scores }),
          })

    return new AnalysisCompleted(params.eventId, params.occurredAt.getTime(), payload)
  }
}
