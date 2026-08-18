import type { GetQuotaBalanceUseCase } from '@/modules/quota/application/use-cases/get-quota-balance/index.js'
import type { ReleaseQuotaReservationUseCase } from '@/modules/quota/application/use-cases/release-quota-reservation/index.js'
import type { ReserveQuotaUseCase } from '@/modules/quota/application/use-cases/reserve-quota/index.js'
import {
  QuotaPublicApiImpl,
  type QuotaPublicApi,
} from '@/modules/quota/presentation/public-api/index.js'

export function createQuotaFacade(dependencies: {
  readonly readQuota: GetQuotaBalanceUseCase
  readonly reserveQuota: ReserveQuotaUseCase
  readonly releaseQuotaReservation: ReleaseQuotaReservationUseCase
}): QuotaPublicApi {
  return new QuotaPublicApiImpl(dependencies)
}
