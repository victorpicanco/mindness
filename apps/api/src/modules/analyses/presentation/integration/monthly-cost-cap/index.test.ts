import { afterAll, beforeAll, beforeEach, describe, expect, inject, it } from 'vitest'

import {
  ANALYSES_TEST_NOW,
  createAnalysesIntegrationContainer,
  type AnalysesIntegrationContainer,
} from '@/modules/analyses/composition/integration-container.js'
import { clearAnalysesData } from '@/modules/analyses/composition/integration-fixtures.js'

let harness: AnalysesIntegrationContainer
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000002'

beforeAll(() => {
  harness = createAnalysesIntegrationContainer({ databaseUrl: inject('databaseUrl') })
})

afterAll(async () => {
  await harness.close()
})

beforeEach(async () => {
  await clearAnalysesData(harness.prisma)
  harness.reset()
  harness.accounts.setPlan(ACCOUNT_ID, 'free')
})

describe('monthly analysis cost cap integration', () => {
  it('enqueues while the current month remains below the cap', async () => {
    await addCostEntry(299_950_000, ANALYSES_TEST_NOW)

    await harness.container.useCases.enqueueSessionAnalysis.execute({
      sessionId: '00000000-0000-0000-0000-000000000011',
      accountId: ACCOUNT_ID,
    })

    expect(harness.processingQueue.enqueued).toHaveLength(1)
    expect(harness.eventBus.published).toHaveLength(0)
  })

  it('publishes a failure and does not enqueue at the cap', async () => {
    await addCostEntry(300_000_000, ANALYSES_TEST_NOW)

    await expect(
      harness.container.useCases.enqueueSessionAnalysis.execute({
        sessionId: '00000000-0000-0000-0000-000000000012',
        accountId: ACCOUNT_ID,
      }),
    ).resolves.toBeUndefined()

    expect(harness.processingQueue.enqueued).toHaveLength(0)
    expect(harness.eventBus.published).toMatchObject([
      {
        eventName: 'analysis_failed',
        payload: { reason: 'monthly_cost_cap_reached', accountId: ACCOUNT_ID },
      },
    ])
  })

  it('does not count entries from the previous month', async () => {
    await addCostEntry(300_000_000, new Date('2026-07-31T23:59:59.000Z'))

    await harness.container.useCases.enqueueSessionAnalysis.execute({
      sessionId: '00000000-0000-0000-0000-000000000013',
      accountId: ACCOUNT_ID,
    })

    expect(harness.processingQueue.enqueued).toHaveLength(1)
    expect(harness.eventBus.published).toHaveLength(0)
  })
})

async function addCostEntry(totalMicrosUsd: number, incurredAt: Date): Promise<void> {
  const suffix = String(totalMicrosUsd) + incurredAt.getTime().toString()
  const sessionId = `00000000-0000-0000-0000-${suffix.slice(-12).padStart(12, '0')}`
  await harness.prisma.analysisCostEntry.create({
    data: {
      id: sessionId,
      sessionId,
      accountId: ACCOUNT_ID,
      transcriptionMicrosUsd: totalMicrosUsd,
      evaluationMicrosUsd: 0,
      totalMicrosUsd,
      incurredAt,
    },
  })
}
