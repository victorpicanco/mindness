import type { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import type { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'

export type AccountPlan = 'free'

export type AccountStatus = 'accessible' | 'deletion_pending'

export interface CreateAccountParams {
  readonly id: string
  readonly email: EmailAddress
  readonly authUserId: string
  readonly timeZone: TimeZone
  readonly createdAt: Date
}

export interface ReconstituteAccountParams extends CreateAccountParams {
  readonly plan: AccountPlan
  readonly status: AccountStatus
  readonly voiceConsent: VoiceConsent | null
}

export interface AcceptVoiceConsentResult {
  readonly changed: boolean
  readonly consent: VoiceConsent
}
