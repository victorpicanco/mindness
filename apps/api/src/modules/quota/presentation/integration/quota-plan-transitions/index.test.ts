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

describe('quota plan transitions integration', () => {
  it('does not enforce or create cycles for paid accounts', async () => {
    const account = createQuotaAccountFixture({ plan: 'plus' })
    harness.accounts.registerAccount(account)

    await expect(
      harness.container.publicApi.readQuota({ accountId: account.accountId }),
    ).resolves.toEqual({
      enforced: false,
    })
    await expect(
      harness.prisma.quotaCycle.count({ where: { accountId: account.accountId } }),
    ).resolves.toBe(0)
  })

  it('persists paid reservations without a cycle and no exhaustion event', async () => {
    const account = createQuotaAccountFixture({ plan: 'plus' })
    harness.accounts.registerAccount(account)

    await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        harness.container.publicApi.reserveForSession({
          accountId: account.accountId,
          sessionId: `paid-${index}`,
        }),
      ),
    )

    const reservations = await harness.prisma.quotaReservation.findMany({
      where: { accountId: account.accountId },
    })
    expect(reservations).toHaveLength(6)
    expect(reservations.every((reservation) => reservation.cycleId === null)).toBe(true)
    expect(
      harness.eventBus.published.filter((event) => event.eventName === 'quota_exhausted'),
    ).toEqual([])
  })

  it('carries recent consumed usage into a newly reopened free cycle', async () => {
    const account = createQuotaAccountFixture({ plan: 'plus' })
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.reserveForSession({
      accountId: account.accountId,
      sessionId: 'recent',
    })
    await harness.container.useCases.consumeQuotaReservation.execute({ sessionId: 'recent' })
    harness.accounts.registerAccount({ ...account, plan: 'free' })

    await harness.container.useCases.reopenFreeQuotaCycle.execute({ accountId: account.accountId })

    const cycle = await harness.container.repositories.quotaCycles.findLatest(account.accountId)
    expect(cycle?.carriedUsage).toBe(1)
    expect(cycle?.window.startsAt).toEqual(harness.clock.now())
  })

  it('does not carry consumption older than the reentry window', async () => {
    const account = createQuotaAccountFixture({ plan: 'plus' })
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.reserveForSession({
      accountId: account.accountId,
      sessionId: 'old',
    })
    await harness.container.useCases.consumeQuotaReservation.execute({ sessionId: 'old' })
    harness.clock.advance(31 * 24 * 60 * 60 * 1000)
    harness.accounts.registerAccount({ ...account, plan: 'free' })

    await harness.container.useCases.reopenFreeQuotaCycle.execute({ accountId: account.accountId })

    const cycle = await harness.container.repositories.quotaCycles.findLatest(account.accountId)
    expect(cycle?.carriedUsage).toBe(0)
  })

  it('keeps an in-flight paid reservation attached and deducted after reentry', async () => {
    const account = createQuotaAccountFixture({ plan: 'plus' })
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.reserveForSession({
      accountId: account.accountId,
      sessionId: 'in-flight',
    })
    harness.accounts.registerAccount({ ...account, plan: 'free' })

    const reopened = await harness.container.useCases.reopenFreeQuotaCycle.execute({
      accountId: account.accountId,
    })
    const reservation =
      await harness.container.repositories.quotaReservations.findBySessionId('in-flight')

    expect(reopened.remaining).toBe(3)
    expect(reservation?.cycleId).not.toBeNull()
    expect(reservation?.status).toBe('held')
  })
})
