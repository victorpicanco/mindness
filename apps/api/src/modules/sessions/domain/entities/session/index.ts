import type { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import type { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'

import type {
  ReconstituteSessionParams,
  SessionExpiredReason,
  SessionState,
  StartSessionParams,
} from './types.js'

const SESSION_DURATION_MILLISECONDS = 15 * 60 * 1000

export class Session {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly themeId: string,
    readonly configuration: SessionConfiguration,
    readonly quotaReservationId: string,
    private _state: SessionState,
    private readonly createdAtEpoch: number,
    private readonly expiresAtEpoch: number,
    private _expiredReason: SessionExpiredReason | null,
    private expiredAtEpoch: number | null,
    private _audio: SessionAudio | null,
    private recordedAtEpoch: number | null,
  ) {}

  get state(): SessionState {
    return this._state
  }

  get createdAt(): Date {
    return new Date(this.createdAtEpoch)
  }

  get expiresAt(): Date {
    return new Date(this.expiresAtEpoch)
  }

  get expiredReason(): SessionExpiredReason | null {
    return this._expiredReason
  }

  get expiredAt(): Date | null {
    return this.expiredAtEpoch === null ? null : new Date(this.expiredAtEpoch)
  }

  get audio(): SessionAudio | null {
    return this._audio
  }

  get recordedAt(): Date | null {
    return this.recordedAtEpoch === null ? null : new Date(this.recordedAtEpoch)
  }

  static start(params: StartSessionParams): Session {
    const createdAtEpoch = params.createdAt.getTime()

    return new Session(
      params.sessionId,
      params.accountId,
      params.themeId,
      params.configuration,
      params.quotaReservationId,
      'in_progress',
      createdAtEpoch,
      createdAtEpoch + SESSION_DURATION_MILLISECONDS,
      null,
      null,
      null,
      null,
    )
  }

  static reconstitute(params: ReconstituteSessionParams): Session {
    return new Session(
      params.sessionId,
      params.accountId,
      params.themeId,
      params.configuration,
      params.quotaReservationId,
      params.state,
      params.createdAt.getTime(),
      params.expiresAt.getTime(),
      params.expiredReason,
      params.expiredAt?.getTime() ?? null,
      params.audio ?? null,
      params.recordedAt?.getTime() ?? null,
    )
  }

  isLiveAt(at: Date): boolean {
    return this._state === 'in_progress' && this.expiresAtEpoch > at.getTime()
  }

  hasElapsedAt(at: Date): boolean {
    return this._state === 'in_progress' && this.expiresAtEpoch <= at.getTime()
  }

  expire(reason: SessionExpiredReason, at: Date): void {
    if (this._state !== 'in_progress') {
      throw new SessionNotInProgressError(this._state)
    }

    this._state = 'expired'
    this._expiredReason = reason
    this.expiredAtEpoch = at.getTime()
  }

  acceptAudio(audio: SessionAudio, at: Date): void {
    // DA-11: a session past its deadline is expired even before a sweep persists the
    // transition, so the aggregate — not the caller — refuses the recording.
    if (!this.isLiveAt(at)) {
      throw new SessionNotInProgressError(this.hasElapsedAt(at) ? 'expired' : this._state)
    }

    this._audio = audio
    this._state = 'processing'
    this.recordedAtEpoch = at.getTime()
  }
}

export type {
  ReconstituteSessionParams,
  SessionExpiredReason,
  SessionState,
  StartSessionParams,
} from './types.js'
