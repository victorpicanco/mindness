import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

export type AnalysisCompletedEvent = IntegrationEvent<
  'analysis_completed',
  { readonly sessionId: string }
>

export class OnAnalysisCompletedCompleteSession {
  constructor(private readonly sessions: SessionsRepository) {}

  async handle(event: AnalysisCompletedEvent): Promise<void> {
    const session = await this.sessions.findById(event.payload.sessionId)
    if (session === null || session.state !== 'processing') return

    session.complete(event.occurredAt)
    await this.sessions.save(session)
  }
}
