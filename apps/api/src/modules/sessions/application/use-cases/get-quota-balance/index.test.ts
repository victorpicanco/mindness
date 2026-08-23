import { describe, expect, it } from 'vitest'

import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'

import { GetSessionQuotaBalanceUseCase } from './index.js'

function createQuota(balance: Awaited<ReturnType<QuotaPort['readBalance']>>): QuotaPort {
  return {
    readBalance: () => Promise.resolve(balance),
    reserveForSession: () =>
      Promise.resolve({ reservationId: 'reservation-1', enforced: true, remaining: 4 }),
    releaseReservation: () => Promise.resolve(),
  }
}

describe('GetSessionQuotaBalanceUseCase', () => {
  it('returns the enforced quota balance for an account', async () => {
    const renewsAt = new Date('2026-09-01T00:00:00.000Z')
    const useCase = new GetSessionQuotaBalanceUseCase({
      quota: createQuota({ enforced: true, allowance: 10, remaining: 4, renewsAt }),
    })

    await expect(useCase.execute({ accountId: 'account-1' })).resolves.toStrictEqual({
      enforced: true,
      allowance: 10,
      remaining: 4,
      renewsAt,
    })
  })

  it('returns the quota balance when enforcement is disabled', async () => {
    const useCase = new GetSessionQuotaBalanceUseCase({
      quota: createQuota({ enforced: false }),
    })

    await expect(useCase.execute({ accountId: 'account-1' })).resolves.toStrictEqual({
      enforced: false,
    })
  })
})
