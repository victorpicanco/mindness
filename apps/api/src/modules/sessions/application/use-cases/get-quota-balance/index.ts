import type { QuotaBalance, QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'

export interface GetSessionQuotaBalanceInput {
  readonly accountId: string
}

export interface GetSessionQuotaBalanceDependencies {
  readonly quota: QuotaPort
}

export class GetSessionQuotaBalanceUseCase {
  constructor(private readonly dependencies: GetSessionQuotaBalanceDependencies) {}

  async execute(input: GetSessionQuotaBalanceInput): Promise<QuotaBalance> {
    return this.dependencies.quota.readBalance(input.accountId)
  }
}
