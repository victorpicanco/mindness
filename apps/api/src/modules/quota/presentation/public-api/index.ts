export type QuotaSnapshot =
  | {
      readonly enforced: true
      readonly allowance: number
      readonly remaining: number
      readonly renewsAt: Date
    }
  | { readonly enforced: false }

export type QuotaReservationGranted =
  | { readonly reservationId: string; readonly enforced: true; readonly remaining: number }
  | { readonly reservationId: string; readonly enforced: false }

export interface QuotaPublicApi {
  readQuota(input: { readonly accountId: string }): Promise<QuotaSnapshot>
  reserveForSession(input: {
    readonly accountId: string
    readonly sessionId: string
  }): Promise<QuotaReservationGranted>
  releaseReservation(input: { readonly sessionId: string }): Promise<void>
}

interface ReadQuota {
  execute(input: { readonly accountId: string }): Promise<QuotaSnapshot>
}

interface ReserveQuota {
  execute(input: {
    readonly accountId: string
    readonly sessionId: string
  }): Promise<QuotaReservationGranted>
}

interface ReleaseQuotaReservation {
  execute(input: { readonly sessionId: string }): Promise<void>
}

export interface QuotaPublicApiDependencies {
  readonly readQuota: ReadQuota
  readonly reserveQuota: ReserveQuota
  readonly releaseQuotaReservation: ReleaseQuotaReservation
}

export class QuotaPublicApiImpl implements QuotaPublicApi {
  constructor(private readonly dependencies: QuotaPublicApiDependencies) {}

  async readQuota(input: { readonly accountId: string }): Promise<QuotaSnapshot> {
    return this.dependencies.readQuota.execute(input)
  }

  async reserveForSession(input: {
    readonly accountId: string
    readonly sessionId: string
  }): Promise<QuotaReservationGranted> {
    return this.dependencies.reserveQuota.execute(input)
  }

  async releaseReservation(input: { readonly sessionId: string }): Promise<void> {
    await this.dependencies.releaseQuotaReservation.execute(input)
  }
}
