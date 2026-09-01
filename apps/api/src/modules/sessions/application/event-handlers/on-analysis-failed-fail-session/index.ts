import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

interface AnalysisFailedPayload {
  readonly sessionId: string
}

export type AnalysisFailedEvent = IntegrationEvent<'analysis_failed', AnalysisFailedPayload>

export class OnAnalysisFailedFailSession {
  constructor(private readonly sessions: SessionsRepository) {}

  async handle(event: AnalysisFailedEvent): Promise<void> {
    const session = await this.sessions.findById(event.payload.sessionId)
    if (session === null || session.state !== 'processing') return

    session.fail('analysis_failed', event.occurredAt)
    await this.sessions.save(session)
  }
}
