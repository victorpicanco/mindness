import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

interface LegacyAnalysisCompletedPayload {
  readonly sessionId: string
  readonly analysisVersion: 1
  readonly scores: { readonly total: number }
}

interface MultimodalAnalysisCompletedPayload {
  readonly sessionId: string
  readonly analysisVersion: 2
}

type AnalysisCompletedPayload = LegacyAnalysisCompletedPayload | MultimodalAnalysisCompletedPayload

export type AnalysisCompletedEvent = IntegrationEvent<
  'analysis_completed',
  AnalysisCompletedPayload
>

export class OnAnalysisCompletedCompleteSession {
  constructor(private readonly sessions: SessionsRepository) {}

  async handle(event: AnalysisCompletedEvent): Promise<void> {
    const session = await this.sessions.findById(event.payload.sessionId)
    if (session === null || session.state !== 'processing') return

    if (event.payload.analysisVersion === 2) {
      session.completeWithoutScore(event.occurredAt)
    } else {
      session.complete(event.payload.scores.total, event.occurredAt)
    }
    await this.sessions.save(session)
  }
}
