import type { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'
import type { SessionAudio } from '@/modules/sessions/domain/value-objects/session-audio/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import { SessionNotDeletableError } from '@/modules/sessions/domain/errors/session-not-deletable-error/index.js'
import { RecordingWindowNotOpenError } from '@/modules/sessions/domain/errors/recording-window-not-open-error/index.js'

import type {
  ReconstituteSessionParams,
  SessionExpiredReason,
  SessionState,
  StartSessionParams,
} from './types.js'

const MINUTE_IN_MILLISECONDS = 60 * 1000
const RECORDING_START_GRACE_MILLISECONDS = 2 * MINUTE_IN_MILLISECONDS
const SESSION_DURATION_MILLISECONDS = 15 * MINUTE_IN_MILLISECONDS

function researchEndsAtEpoch(createdAtEpoch: number, configuration: SessionConfiguration): number {
  return createdAtEpoch + configuration.searchWindowMinutes * MINUTE_IN_MILLISECONDS
}

export class Session {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly themeId: string,
    readonly configuration: SessionConfiguration,
    readonly quotaReservationId: string,
    private _state: SessionState,
    private readonly createdAtEpoch: number,
    private expiresAtEpoch: number,
    private _expiredReason: SessionExpiredReason | null,
    private expiredAtEpoch: number | null,
    private recordingStartedAtEpoch: number | null,
    private _audio: SessionAudio | null,
    private recordedAtEpoch: number | null,
    private _totalScore: number | null,
    private completedAtEpoch: number | null,
    private failedAtEpoch: number | null,
    private deletedAtEpoch: number | null,
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

  get researchEndsAt(): Date {
    return new Date(researchEndsAtEpoch(this.createdAtEpoch, this.configuration))
  }

  get recordingStartedAt(): Date | null {
    return this.recordingStartedAtEpoch === null ? null : new Date(this.recordingStartedAtEpoch)
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

  get totalScore(): number | null {
    return this._totalScore
  }

  get completedAt(): Date | null {
    return this.completedAtEpoch === null ? null : new Date(this.completedAtEpoch)
  }

  get failedAt(): Date | null {
    return this.failedAtEpoch === null ? null : new Date(this.failedAtEpoch)
  }

  get deletedAt(): Date | null {
    return this.deletedAtEpoch === null ? null : new Date(this.deletedAtEpoch)
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
      researchEndsAtEpoch(createdAtEpoch, params.configuration) +
        RECORDING_START_GRACE_MILLISECONDS,
      null,
      null,
      null,
      null,
      null,
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
      params.recordingStartedAt?.getTime() ?? null,
      params.audio ?? null,
      params.recordedAt?.getTime() ?? null,
      params.totalScore ?? null,
      params.completedAt?.getTime() ?? null,
      params.failedAt?.getTime() ?? null,
      params.deletedAt?.getTime() ?? null,
    )
  }

  isLiveAt(at: Date): boolean {
    return this._state === 'in_progress' && this.expiresAtEpoch > at.getTime()
  }

  hasElapsedAt(at: Date): boolean {
    return this._state === 'in_progress' && this.expiresAtEpoch <= at.getTime()
  }

  startRecording(at: Date): Date {
    if (!this.isLiveAt(at)) {
      throw new SessionNotInProgressError(this.hasElapsedAt(at) ? 'expired' : this._state)
    }
    if (this.recordingStartedAtEpoch !== null) return new Date(this.recordingStartedAtEpoch)
    if (at.getTime() < researchEndsAtEpoch(this.createdAtEpoch, this.configuration)) {
      throw new RecordingWindowNotOpenError(this.researchEndsAt)
    }

    this.recordingStartedAtEpoch = at.getTime()
    // Until the recording starts, the deadline is the grace to start it; from here on
    // it is the fifteen-minute bound of DA-11, which covers recording and upload.
    this.expiresAtEpoch = this.createdAtEpoch + SESSION_DURATION_MILLISECONDS

    return new Date(this.recordingStartedAtEpoch)
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
    if (!this.isLiveAt(at)) {
      throw new SessionNotInProgressError(this.hasElapsedAt(at) ? 'expired' : this._state)
    }

    this._audio = audio
    this._state = 'processing'
    this.recordedAtEpoch = at.getTime()
  }

  complete(totalScore: number, at: Date): void {
    if (this._state !== 'processing') {
      throw new SessionNotInProgressError(this._state)
    }

    this._state = 'completed'
    this._totalScore = totalScore
    this.completedAtEpoch = at.getTime()
  }

  fail(at: Date): void {
    if (this._state !== 'processing') {
      throw new SessionNotInProgressError(this._state)
    }

    this._state = 'failed'
    this.failedAtEpoch = at.getTime()
  }

  delete(at: Date): void {
    if (this._state !== 'completed' && this._state !== 'failed' && this._state !== 'expired') {
      throw new SessionNotDeletableError(this._state)
    }

    this._state = 'deleted'
    this.deletedAtEpoch = at.getTime()
  }
}

export type {
  ReconstituteSessionParams,
  SessionExpiredReason,
  SessionState,
  StartSessionParams,
} from './types.js'
