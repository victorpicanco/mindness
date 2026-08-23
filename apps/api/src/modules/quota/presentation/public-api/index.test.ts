import { describe, expect, it } from 'vitest'

import type { QuotaPublicApi } from './index.js'
import { QuotaPublicApiImpl } from './index.js'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false
type Assert<Condition extends true> = Condition

export type QuotaPublicApiExposesOnlySagaOperations = Assert<
  Equal<keyof QuotaPublicApi, 'readQuota' | 'reserveForSession' | 'releaseReservation'>
>

const RENEWS_AT = new Date('2026-09-15T00:00:00.000Z')

const enforcedBalance = {
  enforced: true as const,
  allowance: 4,
  remaining: 3,
  renewsAt: RENEWS_AT,
  cycleId: 'cycle-1',
}
const exemptBalance = { enforced: false as const, cycleId: null }
const enforcedReservation = {
  reservationId: 'reservation-1',
  enforced: true as const,
  remaining: 2,
  cycleId: 'cycle-1',
}
const exemptReservation = {
  reservationId: 'reservation-1',
  enforced: false as const,
  cycleId: null,
}

describe('QuotaPublicApiImpl', () => {
  it('exposes only the three saga operations', () => {
    const methods = Object.getOwnPropertyNames(QuotaPublicApiImpl.prototype).filter(
      (method) => method !== 'constructor',
    )

    expect([...methods].sort()).toEqual(['readQuota', 'releaseReservation', 'reserveForSession'])
  })

  it('translates the enforced balance into the public snapshot', async () => {
    const inputs: unknown[] = []
    const api = new QuotaPublicApiImpl({
      readQuota: {
        execute: (input) => {
          inputs.push(input)
          return Promise.resolve(enforcedBalance)
        },
      },
      reserveQuota: { execute: () => Promise.resolve(enforcedReservation) },
      releaseQuotaReservation: { execute: () => Promise.resolve() },
    })

    await expect(api.readQuota({ accountId: 'account-1' })).resolves.toEqual({
      enforced: true,
      allowance: 4,
      remaining: 3,
      renewsAt: RENEWS_AT,
    })
    expect(inputs).toEqual([{ accountId: 'account-1' }])
  })

  it('translates the exempt balance into the public snapshot', async () => {
    const api = new QuotaPublicApiImpl({
      readQuota: { execute: () => Promise.resolve(exemptBalance) },
      reserveQuota: { execute: () => Promise.resolve(enforcedReservation) },
      releaseQuotaReservation: { execute: () => Promise.resolve() },
    })

    await expect(api.readQuota({ accountId: 'account-1' })).resolves.toEqual({ enforced: false })
  })

  it('translates the enforced reservation into the public grant', async () => {
    const inputs: unknown[] = []
    const api = new QuotaPublicApiImpl({
      readQuota: { execute: () => Promise.resolve(enforcedBalance) },
      reserveQuota: {
        execute: (input) => {
          inputs.push(input)
          return Promise.resolve(enforcedReservation)
        },
      },
      releaseQuotaReservation: { execute: () => Promise.resolve() },
    })

    await expect(
      api.reserveForSession({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toEqual({ reservationId: 'reservation-1', enforced: true, remaining: 2 })
    expect(inputs).toEqual([{ accountId: 'account-1', sessionId: 'session-1' }])
  })

  it('translates the exempt reservation into the public grant', async () => {
    const api = new QuotaPublicApiImpl({
      readQuota: { execute: () => Promise.resolve(enforcedBalance) },
      reserveQuota: { execute: () => Promise.resolve(exemptReservation) },
      releaseQuotaReservation: { execute: () => Promise.resolve() },
    })

    await expect(
      api.reserveForSession({ accountId: 'account-1', sessionId: 'session-1' }),
    ).resolves.toEqual({ reservationId: 'reservation-1', enforced: false })
  })

  it('delegates the release to its use case and resolves without a value', async () => {
    const inputs: unknown[] = []
    const api = new QuotaPublicApiImpl({
      readQuota: { execute: () => Promise.resolve(enforcedBalance) },
      reserveQuota: { execute: () => Promise.resolve(enforcedReservation) },
      releaseQuotaReservation: {
        execute: (input) => {
          inputs.push(input)
          return Promise.resolve()
        },
      },
    })

    await expect(api.releaseReservation({ sessionId: 'session-1' })).resolves.toBeUndefined()
    expect(inputs).toEqual([{ sessionId: 'session-1' }])
  })
})
