import type { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'
import type { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'

import type { CreateAnalysisParams, ReconstituteAnalysisParams } from './types.js'

export class Analysis {
  private constructor(
    readonly id: string,
    readonly sessionId: string,
    readonly clarityScore: PillarScore,
    readonly rhythmScore: PillarScore,
    readonly fluencyScore: PillarScore,
    readonly masteryScore: PillarScore,
    readonly clarityGuidance: string,
    readonly rhythmGuidance: string,
    readonly fluencyGuidance: string,
    readonly masteryGuidance: string,
    readonly rhythmMetrics: RhythmMetrics,
    readonly processingMs: number,
    readonly costMicrosUsd: number,
    readonly totalScore: number,
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
      params.clarityScore,
      params.rhythmScore,
      params.fluencyScore,
      params.masteryScore,
      params.clarityGuidance,
      params.rhythmGuidance,
      params.fluencyGuidance,
      params.masteryGuidance,
      params.rhythmMetrics,
      params.processingMs,
      params.costMicrosUsd,
      calculateTotalScore(params),
      params.createdAt.getTime(),
    )
  }
}

function calculateTotalScore(params: CreateAnalysisParams): number {
  return Math.round(
    (params.clarityScore.value +
      params.rhythmScore.value +
      params.fluencyScore.value +
      params.masteryScore.value) /
      4,
  )
}

export type { CreateAnalysisParams, ReconstituteAnalysisParams } from './types.js'
