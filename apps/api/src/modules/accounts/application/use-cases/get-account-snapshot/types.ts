import type { AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'

export interface GetAccountSnapshotInput {
  readonly accountId: string
}

export interface AccountSnapshot {
  readonly accountId: string
  readonly plan: AccountPlan
  readonly createdAt: Date
}

export type GetAccountSnapshotOutput = AccountSnapshot | null
