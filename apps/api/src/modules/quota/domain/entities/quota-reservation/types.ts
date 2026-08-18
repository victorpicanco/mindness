export type QuotaReservationStatus = 'held' | 'consumed' | 'released'

export interface QuotaReservationCounts {
  readonly held: number
  readonly consumed: number
}

export interface CreateQuotaReservationParams {
  readonly id: string
  readonly accountId: string
  readonly cycleId: string | null
  readonly sessionId: string
  readonly createdAt: Date
}

export interface ReconstituteQuotaReservationParams extends CreateQuotaReservationParams {
  readonly status: QuotaReservationStatus
  readonly resolvedAt: Date | null
}
