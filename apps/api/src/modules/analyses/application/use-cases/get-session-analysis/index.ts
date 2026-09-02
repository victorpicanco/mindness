import { AnalysisViewed } from '@/modules/analyses/domain/events/analysis-viewed/index.js'
import { AnalysisAuthenticationRejectedError } from '@/modules/analyses/domain/errors/analysis-authentication-rejected-error/index.js'
import { AnalysisFailedError } from '@/modules/analyses/domain/errors/analysis-failed-error/index.js'
import { AnalysisNotFoundError } from '@/modules/analyses/domain/errors/analysis-not-found-error/index.js'
import { AnalysisTimedOutError } from '@/modules/analyses/domain/errors/analysis-timed-out-error/index.js'

import type {
  GetSessionAnalysisDependencies,
  GetSessionAnalysisInput,
  GetSessionAnalysisOutput,
} from './types.js'

export class GetSessionAnalysisUseCase {
  constructor(private readonly dependencies: GetSessionAnalysisDependencies) {}

  async execute(input: GetSessionAnalysisInput): Promise<GetSessionAnalysisOutput> {
    const access = await this.dependencies.sessions.checkAnalysisAccess(
      input.sessionId,
      input.accountId,
    )
    if (!access.readable) throw new AnalysisNotFoundError(input.sessionId)

    const analysis = await this.dependencies.analyses.findBySessionId(input.sessionId)
    if (analysis === null) {
      if (access.failure === 'analysis_failed') throw new AnalysisFailedError()
      if (access.failure === 'analysis_timeout') throw new AnalysisTimedOutError()
      throw new AnalysisNotFoundError(input.sessionId)
    }

    const transcription = await this.dependencies.transcriptions.findBySessionId(input.sessionId)
    if (transcription === null) {
      throw new AnalysisNotFoundError(input.sessionId, 'transcription_missing')
    }

    const plan = await this.dependencies.accounts.findPlan(input.accountId)
    if (plan === null) throw new AnalysisAuthenticationRejectedError()

    const viewedAt = this.dependencies.clock.now()
    if (await this.dependencies.analyses.markFirstView(input.sessionId, viewedAt)) {
      await this.dependencies.eventPublisher.publish(
        AnalysisViewed.create({
          sessionId: input.sessionId,
          accountId: input.accountId,
          plan,
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: viewedAt,
        }),
      )
    }

    return {
      sessionId: input.sessionId,
      feedback: analysis.feedback,
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
