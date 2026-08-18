import type { ReleaseQuotaReservationDependencies, ReleaseQuotaReservationInput } from './types.js'

export class ReleaseQuotaReservationUseCase {
  constructor(private readonly dependencies: ReleaseQuotaReservationDependencies) {}

  async execute(input: ReleaseQuotaReservationInput): Promise<void> {
    await this.dependencies.unitOfWork.run(async () => {
      const reservation = await this.dependencies.quotaReservations.findBySessionId(input.sessionId)

      if (reservation === null || reservation.status !== 'held') return

      reservation.release(this.dependencies.clock.now())
      await this.dependencies.quotaReservations.save(reservation)
    })
  }
}

export type { ReleaseQuotaReservationDependencies, ReleaseQuotaReservationInput } from './types.js'
