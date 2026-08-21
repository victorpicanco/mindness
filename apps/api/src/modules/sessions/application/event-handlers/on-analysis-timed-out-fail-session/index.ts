import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

interface AnalysisTimedOutPayload {
  readonly sessionId: string
}

export type AnalysisTimedOutEvent = IntegrationEvent<'analysis_timeout', AnalysisTimedOutPayload>

export class OnAnalysisTimedOutFailSession {
  constructor(
    private readonly sessions: SessionsRepository,
    private readonly quota: QuotaPort,
  ) {}

  async handle(event: AnalysisTimedOutEvent): Promise<void> {
    const session = await this.sessions.findById(event.payload.sessionId)
    if (session === null || session.state !== 'processing') return

    session.fail(event.occurredAt)
    await this.sessions.save(session)
    await this.quota.releaseReservation({ sessionId: session.id })
  }
}
