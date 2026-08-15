import type { AccountPlan, AccountStatus } from '@/generated/prisma/enums.js'

export interface AccountRow {
  readonly id: string
  readonly email: string
  readonly authUserId: string
  readonly timeZone: string
  readonly plan: AccountPlan
  readonly status: AccountStatus
  readonly createdAt: Date
}

export interface AccountUpsertArgs {
  readonly where: { readonly id: string }
  readonly create: AccountRow
  readonly update: AccountRow
}

export interface AccountsPrismaClient {
  readonly account: {
    findUnique(args: { where: { authUserId: string } }): Promise<AccountRow | null>
    upsert(args: AccountUpsertArgs): Promise<AccountRow>
  }
}

export interface TransactionOptions {
  readonly isolationLevel: 'Serializable'
}

export interface AccountsPrismaTransactionRunner {
  $transaction<T>(
    operation: (transaction: AccountsPrismaClient) => Promise<T>,
    options: TransactionOptions,
  ): Promise<T>
}
