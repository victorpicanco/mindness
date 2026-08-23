import { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import { QuotaPolicy } from '@/modules/quota/domain/services/quota-policy/index.js'
import { CycleWindow } from '@/modules/quota/domain/value-objects/cycle-window/index.js'

import type {
  ReopenFreeQuotaCycleDependencies,
  ReopenFreeQuotaCycleInput,
  ReopenFreeQuotaCycleOutput,
} from './types.js'

export class ReopenFreeQuotaCycleUseCase {
  constructor(private readonly dependencies: ReopenFreeQuotaCycleDependencies) {}

  async execute(input: ReopenFreeQuotaCycleInput): Promise<ReopenFreeQuotaCycleOutput> {
    return this.dependencies.unitOfWork.run(async () => {
      const now = this.dependencies.clock.now()
      const window = CycleWindow.create(now)
      const lookbackStartsAt = window.previous().startsAt
      const latestCycle = await this.dependencies.quotaCycles.findLatest(input.accountId)
      const cycle =
        latestCycle !== null && latestCycle.window.equals(window)
          ? latestCycle
          : await this.openCycle(input.accountId, window, latestCycle, lookbackStartsAt, now)

      await this.attachHeldReservations(input.accountId, cycle.id, lookbackStartsAt)

      const counts = await this.dependencies.quotaReservations.countByCycle(cycle.id)

      return {
        allowance: cycle.allowance,
        remaining: cycle.remainingFor(counts),
        renewsAt: cycle.window.renewsAt,
      }
    })
  }

  private async openCycle(
    accountId: string,
    window: CycleWindow,
    latestCycle: QuotaCycle | null,
    lookbackStartsAt: Date,
    now: Date,
  ): Promise<QuotaCycle> {
    const allowance = QuotaPolicy.allowanceFor('free')
    const consumedCount = await this.dependencies.quotaReservations.countConsumedSince(
      accountId,
      lookbackStartsAt,
    )
    const cycle = QuotaCycle.create({
      id: this.dependencies.idGenerator.generate(),
      accountId,
      sequence: (latestCycle?.sequence ?? 0) + 1,
      window,
      allowance,
      carriedUsage: QuotaPolicy.carriedUsageFrom(consumedCount, allowance),
      createdAt: now,
    })
    await this.dependencies.quotaCycles.save(cycle)

    return cycle
  }

  private async attachHeldReservations(
    accountId: string,
    cycleId: string,
    lookbackStartsAt: Date,
  ): Promise<void> {
    const reservations = await this.dependencies.quotaReservations.findHeldByAccountSince(
      accountId,
      lookbackStartsAt,
    )

    for (const reservation of reservations) {
      if (reservation.cycleId === cycleId) continue

      reservation.attachToCycle(cycleId)
      await this.dependencies.quotaReservations.save(reservation)
    }
  }
}

export type {
  ReopenFreeQuotaCycleDependencies,
  ReopenFreeQuotaCycleInput,
  ReopenFreeQuotaCycleOutput,
} from './types.js'
