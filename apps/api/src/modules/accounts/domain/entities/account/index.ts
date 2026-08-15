import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'
import type { EmailAddress } from '@/modules/accounts/domain/value-objects/email-address/index.js'
import type { TimeZone } from '@/modules/accounts/domain/value-objects/time-zone/index.js'
import type { VoiceConsent } from '@/modules/accounts/domain/value-objects/voice-consent/index.js'

import type {
  AccountPlan,
  AccountStatus,
  AcceptVoiceConsentResult,
  CreateAccountParams,
  ReconstituteAccountParams,
} from './types.js'

const INITIAL_PLAN: AccountPlan = 'free'
const INITIAL_STATUS: AccountStatus = 'accessible'

function requireIdentifier(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new InvalidAccountValueError(field)
  }

  return value
}

export class Account {
  private constructor(
    readonly id: string,
    readonly email: EmailAddress,
    readonly authUserId: string,
    private _timeZone: TimeZone,
    readonly plan: AccountPlan,
    private _status: AccountStatus,
    readonly createdAt: Date,
    private _voiceConsent: VoiceConsent | null,
  ) {}

  get voiceConsent(): VoiceConsent | null {
    return this._voiceConsent
  }

  get status(): AccountStatus {
    return this._status
  }

  get timeZone(): TimeZone {
    return this._timeZone
  }

  static create(params: CreateAccountParams): Account {
    return new Account(
      requireIdentifier(params.id, 'id'),
      params.email,
      requireIdentifier(params.authUserId, 'authUserId'),
      params.timeZone,
      INITIAL_PLAN,
      INITIAL_STATUS,
      params.createdAt,
      null,
    )
  }

  static reconstitute(params: ReconstituteAccountParams): Account {
    return new Account(
      requireIdentifier(params.id, 'id'),
      params.email,
      requireIdentifier(params.authUserId, 'authUserId'),
      params.timeZone,
      params.plan,
      params.status,
      params.createdAt,
      params.voiceConsent,
    )
  }

  acceptVoiceConsent(consent: VoiceConsent): AcceptVoiceConsentResult {
    if (this._voiceConsent?.version === consent.version) {
      return { changed: false, consent: this._voiceConsent }
    }
    this._voiceConsent = consent
    return { changed: true, consent }
  }

  changeTimeZone(timeZone: TimeZone): void {
    this._timeZone = timeZone
  }

  scheduleDeletion(): void {
    this._status = 'deletion_pending'
  }
}
