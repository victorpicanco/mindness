import type { QuotaPublicApi } from '@/modules/quota/index.js'
import type {
  QuotaPort,
  QuotaReservation,
  ReleaseQuotaReservationInput,
  ReserveQuotaForSessionInput,
} from '@/modules/sessions/domain/ports/quota-port/index.js'

export type QuotaReservationManager = Pick<
  QuotaPublicApi,
  'releaseReservation' | 'reserveForSession'
>

export class QuotaPortAdapter implements QuotaPort {
  constructor(private readonly quotaFacade: QuotaReservationManager) {}

  async reserveForSession(input: ReserveQuotaForSessionInput): Promise<QuotaReservation> {
    const reservation = await this.quotaFacade.reserveForSession(input)

    return {
      reservationId: reservation.reservationId,
      enforced: reservation.enforced,
      remaining: reservation.enforced ? reservation.remaining : null,
    }
  }

  async releaseReservation(input: ReleaseQuotaReservationInput): Promise<void> {
    await this.quotaFacade.releaseReservation(input)
  }
}
