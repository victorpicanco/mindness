import type { PrismaClient } from '@/generated/prisma/client.js'
import type { AccountPlan, AccountStatus } from '@/generated/prisma/enums.js'

export interface AccountRow {
  readonly id: string
  readonly email: string
  readonly authUserId: string
  readonly timeZone: string
  readonly plan: AccountPlan
  readonly status: AccountStatus
  readonly consentPurpose: string | null
  readonly consentVersion: string | null
  readonly consentAcceptedAt: Date | null
  readonly createdAt: Date
}

export interface AccountUpsertArgs {
  readonly where: { readonly id: string }
  readonly create: AccountRow
  readonly update: AccountRow
}

export interface AccountDeletionRequestRow {
  readonly id: string
  readonly accountId: string
  readonly requestedAt: Date
  readonly scheduledFor: Date
}

export interface AccountDeletionRequestUpsertArgs {
  readonly where: { readonly accountId: string }
  readonly create: AccountDeletionRequestRow
  readonly update: AccountDeletionRequestRow
}

export interface AccountsPrismaClient {
  readonly account: {
    count(): Promise<number>
    findUnique(args: {
      where: { readonly id: string } | { readonly authUserId: string } | { readonly email: string }
    }): Promise<AccountRow | null>
    upsert(args: AccountUpsertArgs): Promise<AccountRow>
  }
  readonly accountDeletionRequest: {
    upsert(args: AccountDeletionRequestUpsertArgs): Promise<AccountDeletionRequestRow>
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

type AssignableTo<TSource extends TTarget, TTarget> = TSource

// Nothing wires the generated client to this narrowed surface yet, so this alias is what
// makes a divergent schema fail at typecheck instead of at composition time.
export type PrismaClientCoversAccounts = AssignableTo<
  PrismaClient,
  AccountsPrismaClient & AccountsPrismaTransactionRunner
>
