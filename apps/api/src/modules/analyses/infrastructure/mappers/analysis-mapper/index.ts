import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import { PillarScore } from '@/modules/analyses/domain/value-objects/pillar-score/index.js'
import { RhythmMetrics } from '@/modules/analyses/domain/value-objects/rhythm-metrics/index.js'
import type { AnalysisRow } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

interface Guidance {
  readonly clarity: string
  readonly rhythm: string
  readonly fluency: string
  readonly mastery: string
}
interface PersistedRhythmMetrics {
  readonly wordsPerMinute: number
  readonly wordCount: number
  readonly speechDurationSeconds: number
  readonly pauseCount: number
  readonly longPauseCount: number
  readonly longestPauseSeconds: number
}
function isGuidance(value: unknown): value is Guidance {
  return (
    typeof value === 'object' &&
    value !== null &&
    'clarity' in value &&
    typeof value.clarity === 'string' &&
    'rhythm' in value &&
    typeof value.rhythm === 'string' &&
    'fluency' in value &&
    typeof value.fluency === 'string' &&
    'mastery' in value &&
    typeof value.mastery === 'string'
  )
}
function isPersistedRhythmMetrics(value: unknown): value is PersistedRhythmMetrics {
  return (
    typeof value === 'object' &&
    value !== null &&
    'wordsPerMinute' in value &&
    typeof value.wordsPerMinute === 'number' &&
    'wordCount' in value &&
    typeof value.wordCount === 'number' &&
    'speechDurationSeconds' in value &&
    typeof value.speechDurationSeconds === 'number' &&
    'pauseCount' in value &&
    typeof value.pauseCount === 'number' &&
    'longPauseCount' in value &&
    typeof value.longPauseCount === 'number' &&
    'longestPauseSeconds' in value &&
    typeof value.longestPauseSeconds === 'number'
  )
}
function metrics(value: unknown): RhythmMetrics {
  if (!isPersistedRhythmMetrics(value)) throw new DatabaseError('Invalid persisted rhythm metrics')
  return RhythmMetrics.create(value)
}
export class AnalysisMapper {
  toDomain(row: AnalysisRow): Analysis {
    if (!isGuidance(row.guidance)) throw new DatabaseError('Invalid persisted analysis guidance')
    return Analysis.reconstitute({
      analysisId: row.id,
      sessionId: row.sessionId,
      clarityScore: PillarScore.create(row.clarityScore),
      rhythmScore: PillarScore.create(row.rhythmScore),
      fluencyScore: PillarScore.create(row.fluencyScore),
      masteryScore: PillarScore.create(row.masteryScore),
      clarityGuidance: row.guidance.clarity,
      rhythmGuidance: row.guidance.rhythm,
      fluencyGuidance: row.guidance.fluency,
      masteryGuidance: row.guidance.mastery,
      rhythmMetrics: metrics(row.rhythmMetrics),
      processingMs: row.processingMs,
      costMicrosUsd: row.costMicrosUsd,
      createdAt: row.createdAt,
    })
  }
  toData(analysis: Analysis): AnalysisRow {
    return {
      id: analysis.id,
      sessionId: analysis.sessionId,
      clarityScore: analysis.clarityScore.value,
      rhythmScore: analysis.rhythmScore.value,
      fluencyScore: analysis.fluencyScore.value,
      masteryScore: analysis.masteryScore.value,
      totalScore: analysis.totalScore,
      guidance: {
        clarity: analysis.clarityGuidance,
        rhythm: analysis.rhythmGuidance,
        fluency: analysis.fluencyGuidance,
        mastery: analysis.masteryGuidance,
      },
      rhythmMetrics: {
        wordsPerMinute: analysis.rhythmMetrics.wordsPerMinute,
        wordCount: analysis.rhythmMetrics.wordCount,
        speechDurationSeconds: analysis.rhythmMetrics.speechDurationSeconds,
        pauseCount: analysis.rhythmMetrics.pauseCount,
        longPauseCount: analysis.rhythmMetrics.longPauseCount,
        longestPauseSeconds: analysis.rhythmMetrics.longestPauseSeconds,
      },
      processingMs: analysis.processingMs,
      costMicrosUsd: analysis.costMicrosUsd,
      createdAt: analysis.createdAt,
    }
  }
}
