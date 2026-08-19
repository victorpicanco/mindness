import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const MICROPHONE_PERMISSION_DENIED = 'microphone_permission_denied'
const MICROPHONE_PERMISSION_DENIED_VERSION = 1

export interface MicrophonePermissionDeniedPayload {
  readonly sessionId: string
  readonly accountId: string
}

export interface CreateMicrophonePermissionDeniedParams extends MicrophonePermissionDeniedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class MicrophonePermissionDenied implements IntegrationEvent<
  typeof MICROPHONE_PERMISSION_DENIED,
  MicrophonePermissionDeniedPayload
> {
  readonly eventName = MICROPHONE_PERMISSION_DENIED
  readonly version = MICROPHONE_PERMISSION_DENIED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: MicrophonePermissionDeniedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateMicrophonePermissionDeniedParams): MicrophonePermissionDenied {
    return new MicrophonePermissionDenied(params.eventId, params.occurredAt.getTime(), {
      sessionId: params.sessionId,
      accountId: params.accountId,
    })
  }
}
