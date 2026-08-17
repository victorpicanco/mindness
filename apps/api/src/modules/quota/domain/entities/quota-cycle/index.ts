import type { QuotaReservationCounts } from '@/modules/quota/domain/entities/quota-reservation/types.js'
import { InvalidQuotaValueError } from '@/modules/quota/domain/errors/invalid-quota-value-error/index.js'
import type { CycleWindow } from '@/modules/quota/domain/value-objects/cycle-window/index.js'

import type { CreateQuotaCycleParams, ReconstituteQuotaCycleParams } from './types.js'

export class QuotaCycle {
  private constructor(
    readonly id: string,
    readonly accountId: string,
    readonly sequence: number,
    readonly window: CycleWindow,
    readonly allowance: number,
    readonly carriedUsage: number,
    private readonly createdAtEpoch: number,
  ) {}

  get createdAt(): Date {
    return new Date(this.createdAtEpoch)
  }

  static create(params: CreateQuotaCycleParams): QuotaCycle {
    QuotaCycle.validate(params)

    return QuotaCycle.from(params)
  }

  static reconstitute(params: ReconstituteQuotaCycleParams): QuotaCycle {
    return QuotaCycle.from(params)
  }

  remainingFor(counts: QuotaReservationCounts): number {
    return Math.max(0, this.allowance - this.carriedUsage - counts.held - counts.consumed)
  }

  isExhaustedFor(counts: QuotaReservationCounts): boolean {
    return this.remainingFor(counts) === 0
  }

  private static from(params: CreateQuotaCycleParams): QuotaCycle {
    return new QuotaCycle(
      params.id,
      params.accountId,
      params.sequence,
      params.window,
      params.allowance,
      params.carriedUsage,
      params.createdAt.getTime(),
    )
  }

  private static validate(params: CreateQuotaCycleParams): void {
    if (!Number.isInteger(params.sequence) || params.sequence < 1) {
      throw new InvalidQuotaValueError('sequence')
    }
    if (!Number.isInteger(params.allowance) || params.allowance < 1) {
      throw new InvalidQuotaValueError('allowance')
    }
    if (
      !Number.isInteger(params.carriedUsage) ||
      params.carriedUsage < 0 ||
      params.carriedUsage > params.allowance
    ) {
      throw new InvalidQuotaValueError('carriedUsage')
    }
  }
}

export type { CreateQuotaCycleParams, ReconstituteQuotaCycleParams } from './types.js'
