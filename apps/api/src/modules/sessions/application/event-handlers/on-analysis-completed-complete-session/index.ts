import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

interface AnalysisCompletedPayload {
  readonly sessionId: string
  readonly scores: { readonly total: number }
}

export type AnalysisCompletedEvent = IntegrationEvent<
  'analysis_completed',
  AnalysisCompletedPayload
>

export class OnAnalysisCompletedCompleteSession {
  constructor(private readonly sessions: SessionsRepository) {}

  async handle(event: AnalysisCompletedEvent): Promise<void> {
    const session = await this.sessions.findById(event.payload.sessionId)
    if (session === null || session.state !== 'processing') return

    session.complete(event.payload.scores.total, event.occurredAt)
    await this.sessions.save(session)
  }
}
