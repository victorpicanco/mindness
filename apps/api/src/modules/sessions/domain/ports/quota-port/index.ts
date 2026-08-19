export interface ReserveQuotaForSessionInput {
  readonly accountId: string
  readonly sessionId: string
}

export interface QuotaReservation {
  readonly reservationId: string
  readonly enforced: boolean
  readonly remaining: number | null
}

export interface ReleaseQuotaReservationInput {
  readonly sessionId: string
}

export interface QuotaPort {
  reserveForSession(input: ReserveQuotaForSessionInput): Promise<QuotaReservation>
  releaseReservation(input: ReleaseQuotaReservationInput): Promise<void>
}
