import type { AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'
import type { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

const CONSENT_ACCEPTED = 'consent_accepted'
const CONSENT_ACCEPTED_VERSION = 1

export interface ConsentAcceptedPayload {
  readonly accountId: string
  readonly plan: AccountPlan
  readonly purpose: VoiceConsent['purpose']
  readonly version: string
}

export interface CreateConsentAcceptedParams extends ConsentAcceptedPayload {
  readonly eventId: string
  readonly occurredAt: Date
}

export class ConsentAccepted implements IntegrationEvent<
  typeof CONSENT_ACCEPTED,
  ConsentAcceptedPayload
> {
  readonly eventName = CONSENT_ACCEPTED
  readonly version = CONSENT_ACCEPTED_VERSION

  private constructor(
    readonly eventId: string,
    private readonly occurredAtEpoch: number,
    readonly payload: ConsentAcceptedPayload,
  ) {}

  get occurredAt(): Date {
    return new Date(this.occurredAtEpoch)
  }

  static create(params: CreateConsentAcceptedParams): ConsentAccepted {
    return new ConsentAccepted(params.eventId, params.occurredAt.getTime(), {
      accountId: params.accountId,
      plan: params.plan,
      purpose: params.purpose,
      version: params.version,
    })
  }
}
