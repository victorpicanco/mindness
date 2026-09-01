import { CommunicationAnalysis } from '@/modules/analyses/domain/entities/communication-analysis/index.js'
import { CommunicationFeedback } from '@/modules/analyses/domain/value-objects/communication-feedback/index.js'
import type { CommunicationAnalysisRow } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'

import { parsePersistedFeedback } from './schemas.js'

export class CommunicationAnalysisMapper {
  toDomain(row: CommunicationAnalysisRow): CommunicationAnalysis {
    return CommunicationAnalysis.reconstitute({
      analysisId: row.id,
      sessionId: row.sessionId,
      feedbackVersion: row.feedbackVersion,
      promptVersion: row.promptVersion,
      feedback: CommunicationFeedback.reconstitute(parsePersistedFeedback(row.feedback)),
      processingMs: row.processingMs,
      costMicrosUsd: row.costMicrosUsd,
      createdAt: row.createdAt,
    })
  }

  toData(analysis: CommunicationAnalysis): CommunicationAnalysisRow {
    const feedback = analysis.feedback

    return {
      id: analysis.id,
      sessionId: analysis.sessionId,
      feedbackVersion: analysis.feedbackVersion,
      promptVersion: analysis.promptVersion,
      feedback: {
        durationSeconds: feedback.durationSeconds,
        audioUsability: feedback.audioUsability,
        alignmentQuality: feedback.alignmentQuality,
        limitations: [...feedback.limitations],
        literalTranscript: feedback.literalTranscript,
        mainMessage: feedback.mainMessage,
        attemptedStructure: feedback.attemptedStructure,
        summary: feedback.summary,
        strengths: feedback.strengths.map((strength) => ({ ...strength })),
        moments: feedback.moments.map((moment) => ({
          ...moment,
          categories: [...moment.categories],
        })),
        patterns: feedback.patterns.map((pattern) => ({
          ...pattern,
          evidenceMomentIds: [...pattern.evidenceMomentIds],
        })),
        asrDivergences: feedback.asrDivergences.map((divergence) => ({ ...divergence })),
        priorities: feedback.priorities.map((priority) => ({
          ...priority,
          evidenceMomentIds: [...priority.evidenceMomentIds],
        })),
      },
      processingMs: analysis.processingMs,
      costMicrosUsd: analysis.costMicrosUsd,
      createdAt: analysis.createdAt,
    }
  }
}
