import { AnalysisViewed } from '@/modules/analyses/domain/events/analysis-viewed/index.js'
import { AnalysisAuthenticationRejectedError } from '@/modules/analyses/domain/errors/analysis-authentication-rejected-error/index.js'
import { AnalysisNotFoundError } from '@/modules/analyses/domain/errors/analysis-not-found-error/index.js'
import { GuidanceSelector } from '@/modules/analyses/domain/services/guidance-selector/index.js'

import type {
  GetSessionAnalysisDependencies,
  GetSessionAnalysisInput,
  GetSessionAnalysisOutput,
} from './types.js'

export class GetSessionAnalysisUseCase {
  constructor(private readonly dependencies: GetSessionAnalysisDependencies) {}

  async execute(input: GetSessionAnalysisInput): Promise<GetSessionAnalysisOutput> {
    const readable = await this.dependencies.sessions.isReadableByAccount(
      input.sessionId,
      input.accountId,
    )
    if (!readable) throw new AnalysisNotFoundError(input.sessionId)

    const analysis = await this.dependencies.analyses.findBySessionId(input.sessionId)
    if (analysis === null) throw new AnalysisNotFoundError(input.sessionId)

    const transcription = await this.dependencies.transcriptions.findBySessionId(input.sessionId)
    if (transcription === null) {
      throw new AnalysisNotFoundError(input.sessionId, 'transcription_missing')
    }

    const plan = await this.dependencies.accounts.findPlan(input.accountId)
    if (plan === null) throw new AnalysisAuthenticationRejectedError()

    const scores = {
      clarity: analysis.clarityScore.value,
      rhythm: analysis.rhythmScore.value,
      fluency: analysis.fluencyScore.value,
      mastery: analysis.masteryScore.value,
      total: analysis.totalScore,
    }
    const guidance = GuidanceSelector.select([
      { pillar: 'clarity', score: scores.clarity, guidance: analysis.clarityGuidance },
      { pillar: 'rhythm', score: scores.rhythm, guidance: analysis.rhythmGuidance },
      { pillar: 'fluency', score: scores.fluency, guidance: analysis.fluencyGuidance },
      { pillar: 'mastery', score: scores.mastery, guidance: analysis.masteryGuidance },
    ])

    const viewedAt = this.dependencies.clock.now()
    const firstView = await this.dependencies.analyses.markFirstView(input.sessionId, viewedAt)
    if (firstView) {
      await this.dependencies.eventPublisher.publish(
        AnalysisViewed.create({
          sessionId: input.sessionId,
          accountId: input.accountId,
          plan,
          scores,
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: viewedAt,
        }),
      )
    }

    return {
      sessionId: input.sessionId,
      scores,
      guidance: guidance.map(({ pillar, guidance: text }) => ({ pillar, text })),
      transcript: transcription.text,
      analyzedAt: analysis.createdAt.toISOString(),
    }
  }
}

export type {
  GetSessionAnalysisDependencies,
  GetSessionAnalysisInput,
  GetSessionAnalysisOutput,
} from './types.js'
