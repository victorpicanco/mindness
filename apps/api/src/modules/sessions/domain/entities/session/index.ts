import type { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import type { SessionState, StartSessionParams } from './types.js'

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
    )
  }
}

export type { SessionState, StartSessionParams } from './types.js'
