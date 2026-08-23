import type { AccountProfile } from './types.js'

export interface AccountsPort {
  resolveAccountId(accessToken: string): Promise<string | null>
  findProfile(accountId: string): Promise<AccountProfile | null>
}

export type { AccountPlan, AccountProfile } from './types.js'
