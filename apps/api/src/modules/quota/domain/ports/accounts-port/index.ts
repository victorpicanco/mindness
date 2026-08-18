import type { QuotaAccount } from './types.js'

export interface AccountsPort {
  findAccount(accountId: string): Promise<QuotaAccount | null>
}

export type { QuotaAccount } from './types.js'
