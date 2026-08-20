import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const RECORDING_SUBMITTED = 'recording_submitted'
const RECORDING_SUBMITTED_VERSION = 1

export interface RecordingSubmittedPayload {
  readonly sessionId: string
  readonly accountId: string
  readonly durationSeconds: number
}

export interface CreateRecordingSubmittedParams extends RecordingSubmittedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class RecordingSubmitted implements IntegrationEvent<
  typeof RECORDING_SUBMITTED,
  RecordingSubmittedPayload
> {
  readonly eventName = RECORDING_SUBMITTED
  readonly version = RECORDING_SUBMITTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: RecordingSubmittedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateRecordingSubmittedParams): RecordingSubmitted {
    return new RecordingSubmitted(params.eventId, params.occurredAt.getTime(), {
      sessionId: params.sessionId,
      accountId: params.accountId,
      durationSeconds: params.durationSeconds,
    })
  }
}
