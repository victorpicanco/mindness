import type { AccountPlan } from './types.js'

export interface AccountsPort {
  findPlan(accountId: string): Promise<AccountPlan | null>
}

export type { AccountPlan } from './types.js'
