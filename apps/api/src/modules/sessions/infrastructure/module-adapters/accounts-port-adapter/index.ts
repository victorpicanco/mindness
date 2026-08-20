import type { AccountsFacade } from '@/modules/accounts/index.js'
import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'

export type AccountsIdentityReader = Pick<AccountsFacade, 'authenticate'>

export class AccountsPortAdapter implements AccountsPort {
  constructor(private readonly accountsFacade: AccountsIdentityReader) {}

  async resolveAccountId(accessToken: string): Promise<string | null> {
    const identity = await this.accountsFacade.authenticate(accessToken)
    return identity.accountId
  }
}
