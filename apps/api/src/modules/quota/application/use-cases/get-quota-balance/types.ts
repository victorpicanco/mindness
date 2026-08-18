import type { AccountsPort } from '@/modules/quota/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { IdGenerator } from '@/modules/quota/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaCyclesRepository } from '@/modules/quota/domain/repositories/quota-cycles-repository/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'

export interface GetQuotaBalanceInput {
  readonly accountId: string
}

export type GetQuotaBalanceOutput =
  | {
      readonly enforced: true
      readonly allowance: number
      readonly remaining: number
      readonly renewsAt: Date
    }
  | {
      readonly enforced: false
    }

export interface GetQuotaBalanceDependencies {
  readonly accounts: AccountsPort
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly quotaCycles: QuotaCyclesRepository
  readonly quotaReservations: QuotaReservationsRepository
  readonly unitOfWork: UnitOfWork
}
