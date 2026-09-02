import { Analysis } from '@/modules/analyses/domain/entities/analysis/index.js'
import type { AnalysisRow } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'

import { parseSpeechFeedback } from '@/modules/analyses/infrastructure/adapters/gemini-evaluation-adapter/schemas.js'

export class AnalysisMapper {
  toDomain(row: AnalysisRow): Analysis {
    return Analysis.reconstitute({
      analysisId: row.id,
      sessionId: row.sessionId,
      feedback: parseSpeechFeedback(row.feedback),
      processingMs: row.processingMs,
      costMicrosUsd: row.costMicrosUsd,
      createdAt: row.createdAt,
    })
  }

  toData(analysis: Analysis): AnalysisRow {
    return {
      id: analysis.id,
      sessionId: analysis.sessionId,
      feedback: analysis.feedback,
      processingMs: analysis.processingMs,
      costMicrosUsd: analysis.costMicrosUsd,
      createdAt: analysis.createdAt,
    }
  }
}
