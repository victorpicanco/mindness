import type { AccountPlan } from './types.js'

export interface AccountsPort {
  findPlan(accountId: string): Promise<AccountPlan | null>
  resolveAccountId(accessToken: string): Promise<string | null>
}

export type { AccountPlan } from './types.js'
