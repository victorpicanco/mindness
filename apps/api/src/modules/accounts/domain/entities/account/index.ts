import { InvalidAccountValueError } from '@/modules/accounts/domain/errors/invalid-account-value-error/index.js'
import type { DisplayName } from '@/modules/accounts/domain/value-objects/display-name/index.js'
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
    private readonly createdAtEpoch: number,
    private _voiceConsent: VoiceConsent | null,
    private _currentSessionId: string | null,
    private _name: DisplayName | null,
  ) {}

  get name(): DisplayName | null {
    return this._name
  }

  get voiceConsent(): VoiceConsent | null {
    return this._voiceConsent
  }

  get currentSessionId(): string | null {
    return this._currentSessionId
  }

  get status(): AccountStatus {
    return this._status
  }

  get timeZone(): TimeZone {
    return this._timeZone
  }

  get createdAt(): Date {
    return new Date(this.createdAtEpoch)
  }

  static create(params: CreateAccountParams): Account {
    return new Account(
      requireIdentifier(params.id, 'id'),
      params.email,
      requireIdentifier(params.authUserId, 'authUserId'),
      params.timeZone,
      INITIAL_PLAN,
      INITIAL_STATUS,
      params.createdAt.getTime(),
      null,
      null,
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
      params.createdAt.getTime(),
      params.voiceConsent,
      params.currentSessionId,
      params.name,
    )
  }

  acceptVoiceConsent(consent: VoiceConsent): AcceptVoiceConsentResult {
    this.requireAccessible()
    if (this._voiceConsent?.version === consent.version) {
      return { changed: false, consent: this._voiceConsent }
    }
    this._voiceConsent = consent
    return { changed: true, consent }
  }

  changeName(name: DisplayName): void {
    this.requireAccessible()
    this._name = name
  }

  changeTimeZone(timeZone: TimeZone): void {
    this.requireAccessible()
    this._timeZone = timeZone
  }

  startSession(sessionId: string): void {
    this.requireAccessible()
    this._currentSessionId = requireIdentifier(sessionId, 'currentSessionId')
  }

  hasCurrentSession(sessionId: string): boolean {
    return this._currentSessionId !== null && this._currentSessionId === sessionId
  }

  canAuthenticate(sessionId: string): boolean {
    return this._status === 'accessible' && this.hasCurrentSession(sessionId)
  }

  canStartPractice(): boolean {
    return this._status === 'accessible' && this._voiceConsent !== null
  }

  scheduleDeletion(): void {
    this._status = 'deletion_pending'
    this._currentSessionId = null
  }

  private requireAccessible(): void {
    if (this._status !== 'accessible') throw new InvalidAccountValueError('status')
  }
}
