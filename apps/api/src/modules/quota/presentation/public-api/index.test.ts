import { describe, expect, it } from 'vitest'

import type { QuotaPublicApi } from './index.js'
import { QuotaPublicApiImpl } from './index.js'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false
type Assert<Condition extends true> = Condition
type QuotaPublicApiExposesOnlySagaOperations = Assert<
  Equal<keyof QuotaPublicApi, 'readQuota' | 'reserveForSession' | 'releaseReservation'>
>

const quotaPublicApiExposesOnlySagaOperations: QuotaPublicApiExposesOnlySagaOperations = true

describe('QuotaPublicApiImpl', () => {
  it('delegates each saga operation to its use case and translates the results', async () => {
    const readQuota = {
      execute: (input: { readonly accountId: string }) => {
        expect(input).toEqual({ accountId: 'account-1' })
        return Promise.resolve({
          enforced: true as const,
          allowance: 4,
          remaining: 3,
          renewsAt: new Date('2026-09-15T00:00:00.000Z'),
        })
      },
    }
    const reserveQuota = {
      execute: (input: { readonly accountId: string; readonly sessionId: string }) => {
        expect(input).toEqual({ accountId: 'account-1', sessionId: 'session-1' })
        return Promise.resolve({
          reservationId: 'reservation-1',
          enforced: true as const,
          remaining: 2,
        })
      },
    }
    const releaseQuotaReservation = {
      execute: (input: { readonly sessionId: string }) => {
        expect(input).toEqual({ sessionId: 'session-1' })
        return Promise.resolve()
      },
    }
    const api = new QuotaPublicApiImpl({ readQuota, reserveQuota, releaseQuotaReservation })

    await expect(api.readQuota({ accountId: 'account-1' })).resolves.toEqual({
      enforced: true,
      allowance: 4,
      remaining: 3,
      renewsAt: new Date('2026-09-15T00:00:00.000Z'),
    })
    await expect(
      api.reserveForSession({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toEqual({ reservationId: 'reservation-1', enforced: true, remaining: 2 })
    await expect(api.releaseReservation({ sessionId: 'session-1' })).resolves.toBeUndefined()
  })

  it('does not expose internal quota operations', () => {
    expect(quotaPublicApiExposesOnlySagaOperations).toBe(true)
    const methods = Object.getOwnPropertyNames(QuotaPublicApiImpl.prototype)

    expect(methods).not.toContain('consumeQuotaReservation')
    expect(methods).not.toContain('reopenFreeQuotaCycle')
  })
})
