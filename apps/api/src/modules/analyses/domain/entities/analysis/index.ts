import type { CreateAnalysisParams, ReconstituteAnalysisParams } from './types.js'
import type { DeliveryFeedback } from '@/modules/analyses/domain/ports/evaluation-port/index.js'

export class Analysis {
  private constructor(
    readonly id: string,
    readonly sessionId: string,
    readonly feedback: CreateAnalysisParams['feedback'],
    readonly processingMs: number,
    readonly costMicrosUsd: number,
    private readonly createdAtEpoch: number,
  ) {}

  get createdAt(): Date {
    return new Date(this.createdAtEpoch)
  }

  static create(params: CreateAnalysisParams): Analysis {
    return Analysis.fromParams(params)
  }

  static reconstitute(params: ReconstituteAnalysisParams): Analysis {
    return Analysis.fromParams(params)
  }

  private static fromParams(params: CreateAnalysisParams): Analysis {
    return new Analysis(
      params.analysisId,
      params.sessionId,
      freezeFeedback(params.feedback),
      params.processingMs,
      params.costMicrosUsd,
      params.createdAt.getTime(),
    )
  }
}

function freezeFeedback(feedback: CreateAnalysisParams['feedback']) {
  return Object.freeze({
    summary: feedback.summary,
    strengths: Object.freeze(feedback.strengths.map((item) => Object.freeze({ ...item }))),
    improvements: Object.freeze(feedback.improvements.map((item) => Object.freeze({ ...item }))),
    ...(feedback.delivery === undefined ? {} : { delivery: freezeDelivery(feedback.delivery) }),
  })
}

function freezeDelivery(delivery: DeliveryFeedback): DeliveryFeedback {
  return Object.freeze({
    ...delivery,
    limitations: Object.freeze([...delivery.limitations]),
    metrics: Object.freeze({
      ...delivery.metrics,
      windows: Object.freeze(
        delivery.metrics.windows.map((window) => Object.freeze({ ...window })),
      ),
    }),
    fillers: Object.freeze({
      ...delivery.fillers,
      byExpression: Object.freeze(
        delivery.fillers.byExpression.map((item) => Object.freeze({ ...item })),
      ),
      occurrences: Object.freeze(
        delivery.fillers.occurrences.map((item) => Object.freeze({ ...item })),
      ),
    }),
    moments: Object.freeze(delivery.moments.map((moment) => Object.freeze({ ...moment }))),
    nextPractice:
      delivery.nextPractice === null ? null : Object.freeze({ ...delivery.nextPractice }),
  })
}

export type { CreateAnalysisParams, ReconstituteAnalysisParams } from './types.js'
