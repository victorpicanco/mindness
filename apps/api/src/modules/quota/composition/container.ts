import { ConsumeQuotaReservationUseCase } from '@/modules/quota/application/use-cases/consume-quota-reservation/index.js'
import { GetQuotaBalanceUseCase } from '@/modules/quota/application/use-cases/get-quota-balance/index.js'
import { ReleaseQuotaReservationUseCase } from '@/modules/quota/application/use-cases/release-quota-reservation/index.js'
import { ReopenFreeQuotaCycleUseCase } from '@/modules/quota/application/use-cases/reopen-free-quota-cycle/index.js'
import { ReserveQuotaUseCase } from '@/modules/quota/application/use-cases/reserve-quota/index.js'
import type { AccountsPort } from '@/modules/quota/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/quota/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/quota/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/quota/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/quota/domain/ports/unit-of-work/index.js'
import type { QuotaCyclesRepository } from '@/modules/quota/domain/repositories/quota-cycles-repository/index.js'
import type { QuotaReservationsRepository } from '@/modules/quota/domain/repositories/quota-reservations-repository/index.js'
import { PrismaUnitOfWorkAdapter } from '@/modules/quota/infrastructure/adapters/prisma-unit-of-work-adapter/index.js'
import type {
  QuotaPrismaClient,
  QuotaPrismaTransactionRunner,
} from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'
import { QuotaTransactionContext } from '@/modules/quota/infrastructure/clients/quota-transaction-context/index.js'
import { QuotaCycleMapper } from '@/modules/quota/infrastructure/mappers/quota-cycle-mapper/index.js'
import { QuotaReservationMapper } from '@/modules/quota/infrastructure/mappers/quota-reservation-mapper/index.js'
import {
  AccountsPortAdapter,
  type AccountsSnapshotReader,
} from '@/modules/quota/infrastructure/module-adapters/accounts-port-adapter/index.js'
import { PrismaQuotaCyclesRepository } from '@/modules/quota/infrastructure/repositories/prisma-quota-cycles-repository/index.js'
import { PrismaQuotaReservationsRepository } from '@/modules/quota/infrastructure/repositories/prisma-quota-reservations-repository/index.js'

import { createQuotaFacade } from './facade.js'

export interface QuotaAdapterOverrides {
  readonly accounts?: AccountsPort
  readonly quotaCycles?: QuotaCyclesRepository
  readonly quotaReservations?: QuotaReservationsRepository
  readonly unitOfWork?: UnitOfWork
}

export interface QuotaModuleDeps {
  readonly prisma: QuotaPrismaClient & QuotaPrismaTransactionRunner
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
  readonly accountsFacade: AccountsSnapshotReader
  readonly adapters?: QuotaAdapterOverrides
}

export function createQuotaContainer(deps: QuotaModuleDeps) {
  const adapters = deps.adapters ?? {}
  const transactionContext = new QuotaTransactionContext()
  const accounts = adapters.accounts ?? new AccountsPortAdapter(deps.accountsFacade)
  const unitOfWork =
    adapters.unitOfWork ?? new PrismaUnitOfWorkAdapter(deps.prisma, transactionContext)
  const quotaCycles =
    adapters.quotaCycles ??
    new PrismaQuotaCyclesRepository(deps.prisma, transactionContext, new QuotaCycleMapper())
  const quotaReservations =
    adapters.quotaReservations ??
    new PrismaQuotaReservationsRepository(
      deps.prisma,
      transactionContext,
      new QuotaReservationMapper(),
    )

  const useCases = {
    consumeQuotaReservation: new ConsumeQuotaReservationUseCase({
      clock: deps.clock,
      quotaReservations,
      unitOfWork,
    }),
    getQuotaBalance: new GetQuotaBalanceUseCase({
      accounts,
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      quotaCycles,
      quotaReservations,
      unitOfWork,
    }),
    releaseQuotaReservation: new ReleaseQuotaReservationUseCase({
      clock: deps.clock,
      quotaReservations,
      unitOfWork,
    }),
    reopenFreeQuotaCycle: new ReopenFreeQuotaCycleUseCase({
      clock: deps.clock,
      idGenerator: deps.idGenerator,
      quotaCycles,
      quotaReservations,
      unitOfWork,
    }),
    reserveQuota: new ReserveQuotaUseCase({
      accounts,
      clock: deps.clock,
      eventPublisher: deps.eventPublisher,
      idGenerator: deps.idGenerator,
      quotaCycles,
      quotaReservations,
      unitOfWork,
    }),
  }

  const publicApi = createQuotaFacade({
    readQuota: useCases.getQuotaBalance,
    reserveQuota: useCases.reserveQuota,
    releaseQuotaReservation: useCases.releaseQuotaReservation,
  })

  return { publicApi, repositories: { quotaCycles, quotaReservations }, useCases }
}

export type QuotaContainer = ReturnType<typeof createQuotaContainer>
