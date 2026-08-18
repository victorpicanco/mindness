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

describe('quota cycle integration', () => {
  it('persists the first free cycle for a new account', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)

    const quota = await harness.container.publicApi.readQuota({ accountId: account.accountId })
    const cycles = await harness.prisma.quotaCycle.findMany({
      where: { accountId: account.accountId },
    })

    expect(quota).toEqual({
      enforced: true,
      allowance: 4,
      remaining: 4,
      renewsAt: new Date('2026-09-15T12:00:00.000Z'),
    })
    expect(cycles).toHaveLength(1)
    expect(cycles[0]?.sequence).toBe(1)
    expect(harness.eventBus.published).toEqual([])
  })

  it('does not persist another cycle when the balance is read repeatedly', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)

    await harness.container.publicApi.readQuota({ accountId: account.accountId })
    await harness.container.publicApi.readQuota({ accountId: account.accountId })

    await expect(
      harness.prisma.quotaCycle.count({ where: { accountId: account.accountId } }),
    ).resolves.toBe(1)
    expect(harness.eventBus.published).toEqual([])
  })

  it('persists the next cycle after renewal', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.readQuota({ accountId: account.accountId })
    harness.clock.advance(31 * 24 * 60 * 60 * 1000)

    const quota = await harness.container.publicApi.readQuota({ accountId: account.accountId })
    const latest = await harness.container.repositories.quotaCycles.findLatest(account.accountId)

    expect(quota).toMatchObject({ enforced: true, remaining: 4 })
    expect(latest?.sequence).toBe(2)
    expect(harness.eventBus.published).toEqual([])
  })

  it('materializes only the window that contains a delayed read', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)
    await harness.container.publicApi.readQuota({ accountId: account.accountId })
    harness.clock.advance(61 * 24 * 60 * 60 * 1000)

    const quota = await harness.container.publicApi.readQuota({ accountId: account.accountId })
    const cycles = await harness.prisma.quotaCycle.findMany({
      where: { accountId: account.accountId },
      orderBy: { sequence: 'asc' },
    })

    expect(quota).toMatchObject({ enforced: true, remaining: 4 })
    expect(cycles).toHaveLength(2)
    expect(cycles[1]?.sequence).toBe(2)
    expect(cycles[1]?.startsAt).toEqual(new Date('2026-10-15T12:00:00.000Z'))
  })

  it('does not create cycles for a paid account', async () => {
    const account = createQuotaAccountFixture({
      accountId: '00000000-0000-4000-8000-000000000002',
      plan: 'plus',
    })
    harness.accounts.registerAccount(account)

    await expect(
      harness.container.publicApi.readQuota({ accountId: account.accountId }),
    ).resolves.toEqual({
      enforced: false,
    })
    await expect(
      harness.prisma.quotaCycle.count({ where: { accountId: account.accountId } }),
    ).resolves.toBe(0)
    expect(harness.eventBus.published).toEqual([])
  })

  it('keeps each account cycle isolated', async () => {
    const accountA = createQuotaAccountFixture({
      accountId: '00000000-0000-4000-8000-000000000003',
    })
    const accountB = createQuotaAccountFixture({
      accountId: '00000000-0000-4000-8000-000000000004',
    })
    harness.accounts.registerAccount(accountA)
    harness.accounts.registerAccount(accountB)

    await harness.container.publicApi.readQuota({ accountId: accountA.accountId })
    await harness.container.publicApi.readQuota({ accountId: accountB.accountId })

    const cycleA = await harness.container.repositories.quotaCycles.findLatest(accountA.accountId)
    const cycleB = await harness.container.repositories.quotaCycles.findLatest(accountB.accountId)

    expect(cycleA?.accountId).toBe(accountA.accountId)
    expect(cycleB?.accountId).toBe(accountB.accountId)
    expect(cycleA?.id).not.toBe(cycleB?.id)
  })
})
