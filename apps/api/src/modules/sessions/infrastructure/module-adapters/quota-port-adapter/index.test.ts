import { describe, expect, it } from 'vitest'

import type { QuotaReservationManager } from './index.js'
import { QuotaPortAdapter } from './index.js'

describe('QuotaPortAdapter', () => {
  it('returns an enforced quota balance from the quota facade', async () => {
    const renewsAt = new Date('2026-09-01T00:00:00.000Z')
    const quotaFacade: QuotaReservationManager = {
      readQuota: () => Promise.resolve({ enforced: true, allowance: 10, remaining: 4, renewsAt }),
      reserveForSession: () =>
        Promise.resolve({ reservationId: 'reservation-1', enforced: true, remaining: 4 }),
      releaseReservation: () => Promise.resolve(),
    }
    const adapter = new QuotaPortAdapter(quotaFacade)

    await expect(adapter.readBalance('account-1')).resolves.toStrictEqual({
      enforced: true,
      allowance: 10,
      remaining: 4,
      renewsAt,
    })
  })

  it('returns a quota balance exempt from enforcement from the quota facade', async () => {
    const quotaFacade: QuotaReservationManager = {
      readQuota: () => Promise.resolve({ enforced: false }),
      reserveForSession: () =>
        Promise.resolve({ reservationId: 'reservation-1', enforced: true, remaining: 4 }),
      releaseReservation: () => Promise.resolve(),
    }
    const adapter = new QuotaPortAdapter(quotaFacade)

    await expect(adapter.readBalance('account-1')).resolves.toStrictEqual({ enforced: false })
  })
})
