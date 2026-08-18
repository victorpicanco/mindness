import { QuotaReservationNotFoundError } from '@/modules/quota/domain/errors/quota-reservation-not-found-error/index.js'

import type { ConsumeQuotaReservationDependencies, ConsumeQuotaReservationInput } from './types.js'

export class ConsumeQuotaReservationUseCase {
  constructor(private readonly dependencies: ConsumeQuotaReservationDependencies) {}

  async execute(input: ConsumeQuotaReservationInput): Promise<void> {
    await this.dependencies.unitOfWork.run(async () => {
      const reservation = await this.dependencies.quotaReservations.findBySessionId(input.sessionId)

      if (reservation === null) throw new QuotaReservationNotFoundError(input.sessionId)
      if (reservation.status === 'consumed') return

      reservation.consume(this.dependencies.clock.now())
      await this.dependencies.quotaReservations.save(reservation)
    })
  }
}

export type { ConsumeQuotaReservationDependencies, ConsumeQuotaReservationInput } from './types.js'
