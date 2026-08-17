import { InvalidQuotaTransitionError } from '@/modules/quota/domain/errors/invalid-quota-transition-error/index.js'

import type {
  CreateQuotaReservationParams,
  QuotaReservationStatus,
  ReconstituteQuotaReservationParams,
} from './types.js'

export class QuotaReservation {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    private _cycleId: string | null,
    readonly sessionId: string,
    private _status: QuotaReservationStatus,
    private readonly createdAtEpoch: number,
    private resolvedAtEpoch: number | null,
  ) {}

  get cycleId(): string | null {
    return this._cycleId
  }

  get status(): QuotaReservationStatus {
    return this._status
  }

  get createdAt(): Date {
    return new Date(this.createdAtEpoch)
  }

  get resolvedAt(): Date | null {
    return this.resolvedAtEpoch === null ? null : new Date(this.resolvedAtEpoch)
  }

  static create(params: CreateQuotaReservationParams): QuotaReservation {
    return new QuotaReservation(
      params.id,
      params.accountId,
      params.cycleId,
      params.sessionId,
      'held',
      params.createdAt.getTime(),
      null,
    )
  }

  static reconstitute(params: ReconstituteQuotaReservationParams): QuotaReservation {
    return new QuotaReservation(
      params.id,
      params.accountId,
      params.cycleId,
      params.sessionId,
      params.status,
      params.createdAt.getTime(),
      params.resolvedAt?.getTime() ?? null,
    )
  }

  consume(at: Date): void {
    this.transitionTo('consumed', at)
  }

  release(at: Date): void {
    this.transitionTo('released', at)
  }

  attachToCycle(cycleId: string): void {
    if (this._cycleId === cycleId) {
      return
    }
    if (this._status !== 'held') {
      throw new InvalidQuotaTransitionError(this._status, 'held')
    }

    this._cycleId = cycleId
  }

  countsAgainstBalance(): boolean {
    return this._status === 'held' || this._status === 'consumed'
  }

  private transitionTo(targetStatus: QuotaReservationStatus, at: Date): void {
    if (this._status === targetStatus) {
      return
    }
    if (this._status !== 'held') {
      throw new InvalidQuotaTransitionError(this._status, targetStatus)
    }

    this._status = targetStatus
    this.resolvedAtEpoch = at.getTime()
  }
}

export type {
  CreateQuotaReservationParams,
  QuotaReservationCounts,
  QuotaReservationStatus,
  ReconstituteQuotaReservationParams,
} from './types.js'
