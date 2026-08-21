import type { EnqueueSessionAnalysisUseCase } from '@/modules/analyses/application/use-cases/enqueue-session-analysis/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

interface RecordingSubmittedPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly durationSeconds: number
}

export class OnRecordingSubmittedEnqueueAnalysis {
  private readonly handledEventIds = new Set<string>()

  constructor(
    private readonly enqueueSessionAnalysis: Pick<EnqueueSessionAnalysisUseCase, 'execute'>,
  ) {}

  async handle(event: IntegrationEvent<string, unknown>): Promise<void> {
    const payload = parseRecordingSubmittedPayload(event.payload)
    if (payload === null || this.handledEventIds.has(event.eventId)) return

    this.handledEventIds.add(event.eventId)
    try {
      await this.enqueueSessionAnalysis.execute({
        sessionId: payload.sessionId,
        accountId: payload.accountId,
      })
    } catch (error) {
      this.handledEventIds.delete(event.eventId)
      throw error
    }
  }
}

function parseRecordingSubmittedPayload(payload: unknown): RecordingSubmittedPayload | null {
  if (typeof payload !== 'object' || payload === null) return null
  if (!('sessionId' in payload) || typeof payload.sessionId !== 'string') return null
  if (!('accountId' in payload) || typeof payload.accountId !== 'string') return null
  if (!('durationSeconds' in payload) || typeof payload.durationSeconds !== 'number') return null
  if (!Number.isFinite(payload.durationSeconds) || payload.durationSeconds <= 0) return null

  return {
    sessionId: payload.sessionId,
    accountId: payload.accountId,
    durationSeconds: payload.durationSeconds,
  }
}
