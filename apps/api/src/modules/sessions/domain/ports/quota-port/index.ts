export interface ReserveQuotaForSessionInput {
  readonly accountId: string
  readonly sessionId: string
}

export interface QuotaReservation {
  readonly reservationId: string
  readonly enforced: boolean
  readonly remaining: number | null
}

export type QuotaBalance =
  | {
      readonly enforced: true
      readonly allowance: number
      readonly remaining: number
      readonly renewsAt: Date
    }
  | { readonly enforced: false }

export interface ReleaseQuotaReservationInput {
  readonly sessionId: string
}

export interface QuotaPort {
  readBalance(accountId: string): Promise<QuotaBalance>
  reserveForSession(input: ReserveQuotaForSessionInput): Promise<QuotaReservation>
  releaseReservation(input: ReleaseQuotaReservationInput): Promise<void>
}
