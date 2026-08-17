import type { AccountsFacade } from '@/modules/accounts/index.js'
import type { AccountsPort } from '@/modules/quota/domain/ports/accounts-port/index.js'
import type { QuotaAccount } from '@/modules/quota/domain/ports/accounts-port/types.js'

export class AccountsPortAdapter implements AccountsPort {
  constructor(private readonly accountsFacade: AccountsFacade) {}

  async findAccount(accountId: string): Promise<QuotaAccount | null> {
    const account = await this.accountsFacade.getAccountSnapshot(accountId)

    return account === null
      ? null
      : { accountId: account.accountId, plan: account.plan, createdAt: account.createdAt }
  }
}
