import type { EnqueueSessionAnalysisUseCase } from '@/modules/analyses/application/use-cases/enqueue-session-analysis/index.js'
import type { AnalysisLogger } from '@/modules/analyses/domain/ports/analysis-logger/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

interface RecordingSubmittedPayload {
  readonly sessionId: string
  readonly accountId: string
}

export class OnRecordingSubmittedEnqueueAnalysis {
  constructor(
    private readonly enqueueSessionAnalysis: Pick<EnqueueSessionAnalysisUseCase, 'execute'>,
    private readonly logger: AnalysisLogger,
  ) {}

  async handle(event: IntegrationEvent<string, unknown>): Promise<void> {
    const payload = parseRecordingSubmittedPayload(event.payload)
    if (payload === null) {
      this.logger.warn({ eventId: event.eventId }, 'recording_submitted_payload_rejected')
      return
    }

    await this.enqueueSessionAnalysis.execute({
      sessionId: payload.sessionId,
      accountId: payload.accountId,
    })
  }
}

function parseRecordingSubmittedPayload(payload: unknown): RecordingSubmittedPayload | null {
  if (typeof payload !== 'object' || payload === null) return null
  if (!('sessionId' in payload) || typeof payload.sessionId !== 'string') return null
  if (!('accountId' in payload) || typeof payload.accountId !== 'string') return null

  return { sessionId: payload.sessionId, accountId: payload.accountId }
}
