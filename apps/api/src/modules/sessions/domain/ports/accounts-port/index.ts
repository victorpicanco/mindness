import type { AccountProfile } from './types.js'

export interface AccountsPort {
  resolveAccountId(accessToken: string): Promise<string | null>
  findProfile(accountId: string): Promise<AccountProfile | null>
  canStartPractice(accountId: string): Promise<boolean>
}

export type { AccountPlan, AccountProfile } from './types.js'
