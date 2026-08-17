import type { CycleWindow } from '@/modules/quota/domain/value-objects/cycle-window/index.js'

export interface QuotaReservationCounts {
  readonly heldCount: number
  readonly consumedCount: number
}

export interface CreateQuotaCycleParams {
  readonly id: string
  readonly accountId: string
  readonly sequence: number
  readonly window: CycleWindow
  readonly allowance: number
  readonly carriedUsage: number
  readonly createdAt: Date
}

export type ReconstituteQuotaCycleParams = CreateQuotaCycleParams
