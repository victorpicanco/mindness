import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  createQuotaIntegrationContainer,
  type QuotaIntegrationContainer,
} from '@/modules/quota/composition/integration-container.js'
import {
  clearQuotaData,
  createQuotaAccountFixture,
} from '@/modules/quota/composition/integration-fixtures.js'

let harness: QuotaIntegrationContainer

beforeAll(() => {
  harness = createQuotaIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearQuotaData(harness.prisma)
  harness.reset()
})

describe('quota reservation lifecycle integration', () => {
  it('rejects the fifth reservation without persisting it and emits one exhaustion event', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)

    for (const sessionId of ['session-1', 'session-2', 'session-3', 'session-4']) {
      await harness.container.publicApi.reserveForSession({
        accountId: account.accountId,
        sessionId,
      })
    }

    await expect(
      harness.container.publicApi.reserveForSession({
        accountId: account.accountId,
        sessionId: 'session-5',
      }),
    ).rejects.toMatchObject({ code: 'quota.QUOTA_EXHAUSTED' })

    await expect(harness.prisma.quotaReservation.count()).resolves.toBe(4)
    expect(harness.eventBus.published).toHaveLength(1)
    expect(harness.eventBus.published[0]).toMatchObject({
      eventName: 'quota_exhausted',
      payload: { accountId: account.accountId, renewsAt: '2026-09-15T12:00:00.000Z' },
    })
  })

  it('holds one unit for each session started at the same instant', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)

    await Promise.all([
      harness.container.publicApi.reserveForSession({
        accountId: account.accountId,
        sessionId: 'session-a',
      }),
      harness.container.publicApi.reserveForSession({
        accountId: account.accountId,
        sessionId: 'session-b',
      }),
    ])

    await expect(
      harness.prisma.quotaReservation.count({ where: { status: 'held' } }),
    ).resolves.toBe(2)
    await expect(
      harness.container.publicApi.readQuota({ accountId: account.accountId }),
    ).resolves.toMatchObject({
      enforced: true,
      remaining: 2,
    })
  })

  it('keeps a consumed reservation deducted from its cycle', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.reserveForSession({
      accountId: account.accountId,
      sessionId: 'completed',
    })

    await harness.container.useCases.consumeQuotaReservation.execute({ sessionId: 'completed' })

    await expect(
      harness.container.publicApi.readQuota({ accountId: account.accountId }),
    ).resolves.toMatchObject({
      enforced: true,
      remaining: 3,
    })
    await expect(
      harness.container.repositories.quotaReservations.findBySessionId('completed'),
    ).resolves.toMatchObject({
      status: 'consumed',
    })
  })

  it('returns a released held unit to the current cycle', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.reserveForSession({
      accountId: account.accountId,
      sessionId: 'released',
    })

    await harness.container.publicApi.releaseReservation({ sessionId: 'released' })

    await expect(
      harness.container.publicApi.readQuota({ accountId: account.accountId }),
    ).resolves.toMatchObject({
      enforced: true,
      remaining: 4,
    })
  })

  it('treats repeat and unknown releases as no-ops', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.reserveForSession({
      accountId: account.accountId,
      sessionId: 'released',
    })
    await harness.container.publicApi.releaseReservation({ sessionId: 'released' })

    await expect(
      harness.container.publicApi.releaseReservation({ sessionId: 'released' }),
    ).resolves.toBeUndefined()
    await expect(
      harness.container.publicApi.releaseReservation({ sessionId: 'unknown' }),
    ).resolves.toBeUndefined()
  })

  it('does not release an already consumed reservation', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.reserveForSession({
      accountId: account.accountId,
      sessionId: 'consumed',
    })
    await harness.container.useCases.consumeQuotaReservation.execute({ sessionId: 'consumed' })
    const before = await harness.container.publicApi.readQuota({ accountId: account.accountId })
    const reservationBefore =
      await harness.container.repositories.quotaReservations.findBySessionId('consumed')

    await expect(
      harness.container.publicApi.releaseReservation({ sessionId: 'consumed' }),
    ).resolves.toBeUndefined()

    const after = await harness.container.publicApi.readQuota({ accountId: account.accountId })
    const reservationAfter =
      await harness.container.repositories.quotaReservations.findBySessionId('consumed')
    expect(after).toEqual(before)
    expect(reservationAfter).toMatchObject({
      status: 'consumed',
      resolvedAt: reservationBefore?.resolvedAt,
    })
  })
})
