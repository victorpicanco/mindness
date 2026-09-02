import type { CreateAnalysisParams, ReconstituteAnalysisParams } from './types.js'

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
  })
}

export type { CreateAnalysisParams, ReconstituteAnalysisParams } from './types.js'
