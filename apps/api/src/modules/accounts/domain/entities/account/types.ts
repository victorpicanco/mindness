import type { DisplayName } from '@/modules/accounts/domain/value-objects/display-name/index.js'
import type { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import type { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'

export type AccountPlan = 'free'

export type AccountKind = 'guest' | 'registered'

export type AccountStatus = 'accessible' | 'deletion_pending'

export interface CreateGuestAccountParams {
  readonly id: string
  readonly authUserId: string
  readonly timeZone: TimeZone
  readonly createdAt: Date
}

export interface CreateRegisteredAccountParams extends CreateGuestAccountParams {
  readonly email: EmailAddress
}

export interface ReconstituteAccountParams extends CreateGuestAccountParams {
  readonly kind: AccountKind
  readonly email: EmailAddress | null
  readonly plan: AccountPlan
  readonly status: AccountStatus
  readonly name: DisplayName | null
  readonly voiceConsent: VoiceConsent | null
  readonly currentSessionId: string | null
}

export interface AcceptVoiceConsentResult {
  readonly changed: boolean
  readonly consent: VoiceConsent
}
