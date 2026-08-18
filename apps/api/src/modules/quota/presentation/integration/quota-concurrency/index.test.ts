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

describe('quota concurrency integration', () => {
  it('never persists more held reservations than the free balance', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        harness.container.publicApi.reserveForSession({
          accountId: account.accountId,
          sessionId: `concurrent-${index}`,
        }),
      ),
    )
    const rejected = results.filter((result) => result.status === 'rejected')

    await expect(
      harness.prisma.quotaReservation.count({ where: { status: 'held' } }),
    ).resolves.toBe(4)
    expect(rejected).toHaveLength(4)
    expect(
      rejected.every(
        (result) => result.status === 'rejected' && isQuotaExhaustedError(result.reason),
      ),
    ).toBe(true)
    expect(
      harness.eventBus.published.filter((event) => event.eventName === 'quota_exhausted'),
    ).toHaveLength(4)
    await expect(
      harness.prisma.quotaCycle.count({ where: { accountId: account.accountId } }),
    ).resolves.toBe(1)
    await expect(
      harness.container.publicApi.readQuota({ accountId: account.accountId }),
    ).resolves.toMatchObject({
      enforced: true,
      remaining: 0,
    })
  })

  it('persists one reservation for concurrent attempts sharing a session id', async () => {
    const account = createQuotaAccountFixture()
    harness.accounts.registerAccount(account)

    await Promise.all(
      Array.from({ length: 8 }, () =>
        harness.container.publicApi.reserveForSession({
          accountId: account.accountId,
          sessionId: 'same-session',
        }),
      ),
    )

    await expect(
      harness.prisma.quotaReservation.count({ where: { sessionId: 'same-session' } }),
    ).resolves.toBe(1)
  })
})

function isQuotaExhaustedError(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'quota.QUOTA_EXHAUSTED'
}
