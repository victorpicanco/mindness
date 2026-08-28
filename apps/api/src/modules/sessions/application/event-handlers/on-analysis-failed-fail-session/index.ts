import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

interface AnalysisFailedPayload {
  readonly sessionId: string
}

export type AnalysisFailedEvent = IntegrationEvent<'analysis_failed', AnalysisFailedPayload>

export class OnAnalysisFailedFailSession {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly quota: QuotaPort,
  ) {}

  async handle(event: AnalysisFailedEvent): Promise<void> {
    const session = await this.sessions.findById(event.payload.sessionId)
    if (session === null || session.state !== 'processing') return

    session.fail('analysis_failed', event.occurredAt)
    await this.quota.releaseReservation({ sessionId: session.id })
    await this.sessions.save(session)
  }
}
