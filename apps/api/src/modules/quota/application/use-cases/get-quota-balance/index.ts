import { QuotaCycle } from '@/modules/quota/domain/entities/quota-cycle/index.js'
import { QuotaAccountNotFoundError } from '@/modules/quota/domain/errors/quota-account-not-found-error/index.js'
import { QuotaPolicy } from '@/modules/quota/domain/services/quota-policy/index.js'
import { CycleWindow } from '@/modules/quota/domain/value-objects/cycle-window/index.js'

import type {
  GetQuotaBalanceDependencies,
  GetQuotaBalanceInput,
  GetQuotaBalanceOutput,
} from './types.js'

export class GetQuotaBalanceUseCase {
  constructor(private readonly dependencies: GetQuotaBalanceDependencies) {}

  async execute(input: GetQuotaBalanceInput): Promise<GetQuotaBalanceOutput> {
    const account = await this.dependencies.accounts.findAccount(input.accountId)

    if (account === null) {
      throw new QuotaAccountNotFoundError(input.accountId)
    }

    if (!QuotaPolicy.isEnforced(account.plan)) {
      return { enforced: false }
    }

    return this.dependencies.unitOfWork.run(async () => {
      const now = this.dependencies.clock.now()
      const currentCycle = await this.dependencies.quotaCycles.findCurrent(account.accountId, now)
      const cycle =
        currentCycle ?? (await this.openCycle(account.accountId, account.createdAt, now))
      const counts = await this.dependencies.quotaReservations.countByCycle(cycle.id)

      return {
        enforced: true,
        allowance: cycle.allowance,
        remaining: cycle.remainingFor(counts),
        renewsAt: cycle.window.renewsAt,
      }
    })
  }

  private async openCycle(accountId: string, createdAt: Date, now: Date): Promise<QuotaCycle> {
    const latestCycle = await this.dependencies.quotaCycles.findLatest(accountId)
    const window =
      latestCycle === null
        ? CycleWindow.create(createdAt).advanceTo(now)
        : latestCycle.window.advanceTo(now)
    const cycle = QuotaCycle.create({
      id: this.dependencies.idGenerator.generate(),
      accountId,
      sequence: (latestCycle?.sequence ?? 0) + 1,
      window,
      allowance: QuotaPolicy.allowanceFor('free'),
      carriedUsage: 0,
      createdAt: now,
    })

    await this.dependencies.quotaCycles.save(cycle)

    return cycle
  }
}

export type {
  GetQuotaBalanceDependencies,
  GetQuotaBalanceInput,
  GetQuotaBalanceOutput,
} from './types.js'
