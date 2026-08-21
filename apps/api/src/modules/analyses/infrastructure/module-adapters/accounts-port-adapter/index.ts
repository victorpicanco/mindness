import type { AccountsFacade } from '@/modules/accounts/index.js'
import type { AccountsPort } from '@/modules/analyses/domain/ports/accounts-port/index.js'

export type AccountsPlanReader = Pick<AccountsFacade, 'getAccountSnapshot'>
export class AccountsPortAdapter implements AccountsPort {
  constructor(private readonly accounts: AccountsPlanReader) {}
  async findPlan(accountId: string): Promise<'free' | null> {
    const snapshot = await this.accounts.getAccountSnapshot(accountId)
    return snapshot === null ? null : snapshot.plan
  }
}
