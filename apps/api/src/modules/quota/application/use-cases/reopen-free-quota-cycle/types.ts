import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { IdGenerator } from '@/modules/quota/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaCyclesRepository } from '@/modules/quota/domain/repositories/quota-cycles-repository/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'

export interface ReopenFreeQuotaCycleInput {
  readonly accountId: string
}

export interface ReopenFreeQuotaCycleOutput {
  readonly allowance: number
  readonly remaining: number
  readonly renewsAt: Date
}

export interface ReopenFreeQuotaCycleDependencies {
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly quotaCycles: QuotaCyclesRepository
  readonly quotaReservations: QuotaReservationsRepository
  readonly unitOfWork: UnitOfWork
}
