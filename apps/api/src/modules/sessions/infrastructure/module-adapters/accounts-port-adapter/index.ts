import type { AccountsFacade } from '@/modules/accounts/index.js'
import type {
  AccountProfile,
  AccountsPort,
} from '@/modules/sessions/domain/ports/accounts-port/index.js'

export type AccountsIdentityReader = Pick<AccountsFacade, 'authenticate' | 'getAccountSnapshot'>

export class AccountsPortAdapter implements AccountsPort {
  constructor(private readonly accountsFacade: AccountsIdentityReader) {}

  async resolveAccountId(accessToken: string): Promise<string | null> {
    const identity = await this.accountsFacade.authenticate(accessToken)
    return identity.accountId
  }

  async findProfile(accountId: string): Promise<AccountProfile | null> {
    const snapshot = await this.accountsFacade.getAccountSnapshot(accountId)
    return snapshot === null ? null : { plan: snapshot.plan, timeZone: snapshot.timeZone }
  }
}
