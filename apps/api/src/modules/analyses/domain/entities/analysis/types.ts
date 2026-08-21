import type { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'
import type { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'

export interface CreateAnalysisParams {
  readonly analysisId: string
  readonly sessionId: string
  readonly clarityScore: PillarScore
  readonly rhythmScore: PillarScore
  readonly fluencyScore: PillarScore
  readonly masteryScore: PillarScore
  readonly clarityGuidance: string
  readonly rhythmGuidance: string
  readonly fluencyGuidance: string
  readonly masteryGuidance: string
  readonly rhythmMetrics: RhythmMetrics
  readonly processingMs: number
  readonly costMicrosUsd: number
  readonly createdAt: Date
}

export type ReconstituteAnalysisParams = CreateAnalysisParams
