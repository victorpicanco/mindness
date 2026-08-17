import type { QuotaReservationStatus } from '@/generated/prisma/enums.js'

export interface QuotaCycleRow {
  readonly id: string
  readonly accountId: string
  readonly sequence: number
  readonly startsAt: Date
  readonly renewsAt: Date
  readonly allowance: number
  readonly carriedUsage: number
  readonly createdAt: Date
}

export interface QuotaReservationRow {
  readonly id: string
  readonly accountId: string
  readonly cycleId: string | null
  readonly sessionId: string
  readonly status: QuotaReservationStatus
  readonly createdAt: Date
  readonly resolvedAt: Date | null
}

export interface QuotaCycleFindCurrentArgs {
  readonly where: {
    readonly accountId: string
    readonly startsAt: { readonly lte: Date }
    readonly renewsAt: { readonly gt: Date }
  }
}

export interface QuotaCycleFindLatestArgs {
  readonly where: { readonly accountId: string }
  readonly orderBy: { readonly sequence: 'desc' }
}

export interface QuotaCycleCreateArgs {
  readonly data: QuotaCycleRow
}

export interface QuotaReservationFindArgs {
  readonly where: { readonly sessionId: string }
}

export interface QuotaReservationCountArgs {
  readonly where: {
    readonly cycleId?: string
    readonly accountId?: string
    readonly status: QuotaReservationStatus
    readonly resolvedAt?: { readonly gte: Date }
  }
}

export interface QuotaReservationUpsertArgs {
  readonly where: { readonly id: string }
  readonly create: QuotaReservationRow
  readonly update: QuotaReservationRow
}

export interface QuotaCyclesPrismaClient {
  readonly quotaCycle: {
    findFirst(args: QuotaCycleFindCurrentArgs): Promise<QuotaCycleRow | null>
    findFirst(args: QuotaCycleFindLatestArgs): Promise<QuotaCycleRow | null>
    create(args: QuotaCycleCreateArgs): Promise<QuotaCycleRow>
  }
}

export interface QuotaReservationsPrismaClient {
  readonly quotaReservation: {
    count(args: QuotaReservationCountArgs): Promise<number>
    findUnique(args: QuotaReservationFindArgs): Promise<QuotaReservationRow | null>
    upsert(args: QuotaReservationUpsertArgs): Promise<QuotaReservationRow>
  }
}

export interface QuotaPrismaClient extends QuotaCyclesPrismaClient, QuotaReservationsPrismaClient {}

export interface TransactionOptions {
  readonly isolationLevel: 'Serializable'
}

export interface QuotaPrismaTransactionRunner {
  $transaction<T>(
    operation: (transaction: QuotaPrismaClient) => Promise<T>,
    options: TransactionOptions,
  ): Promise<T>
}
