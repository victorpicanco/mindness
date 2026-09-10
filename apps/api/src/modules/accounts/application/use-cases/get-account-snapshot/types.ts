import type { AccountKind, AccountPlan } from '@/modules/accounts/domain/entities/account/types.js'

export interface GetAccountSnapshotInput {
  readonly accountId: string
}

export interface AccountSnapshot {
  readonly accountId: string
  readonly kind: AccountKind
  readonly plan: AccountPlan
  readonly createdAt: Date
  readonly timeZone: string
}

export type GetAccountSnapshotOutput = AccountSnapshot | null
