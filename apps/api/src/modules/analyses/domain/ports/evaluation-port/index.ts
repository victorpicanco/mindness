import type { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'

import type { EvaluationResult } from './types.js'

export interface EvaluationPort {
  evaluate(input: {
    readonly themeTitle: string
    readonly transcript: string
    readonly rhythm: RhythmMetrics
    readonly signal: AbortSignal
  }): Promise<EvaluationResult>
}

export type { EvaluationResult } from './types.js'
