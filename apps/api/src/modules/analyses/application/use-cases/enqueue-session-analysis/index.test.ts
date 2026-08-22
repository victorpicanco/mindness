import type { AnalysisLogger } from '@/modules/analyses/domain/ports/analysis-logger/index.js'
import { FakeEventBus } from '@/shared/messaging/fake-event-bus/index.js'
import { ControllableClock } from '@/shared/time/controllable-clock/index.js'
import { describe, expect, it } from 'vitest'

import { EnqueueSessionAnalysisUseCase } from './index.js'
import type { EnqueueSessionAnalysisDependencies } from './types.js'

class InMemoryAnalysisCostEntriesRepository {
  receivedWindow: { readonly from: Date; readonly to: Date } | null = null

  constructor(private readonly totalMicros: number) {}

  save(): Promise<void> {
    return Promise.resolve()
  }

  sumMicrosBetween(from: Date, to: Date): Promise<number> {
    this.receivedWindow = { from, to }
    return Promise.resolve(this.totalMicros)
  }
}

class InMemoryAccountsPort {
  constructor(private readonly plan: 'free' | null = 'free') {}

  findPlan(): Promise<'free' | null> {
    return Promise.resolve(this.plan)
  }
}

class SequentialIdGenerator {
  private sequence = 0

  generate(): string {
    this.sequence += 1
    return `event-${this.sequence}`
  }
}

class InMemoryAnalysisLogger implements AnalysisLogger {
  readonly warnings: { readonly context: unknown; readonly message: string }[] = []

  warn(context: unknown, message: string): void {
    this.warnings.push({ context, message })
  }
}

class InMemoryProcessingQueue {
  readonly enqueued: { readonly sessionId: string }[] = []

  enqueue(input: { readonly sessionId: string }): Promise<void> {
    this.enqueued.push(input)
    return Promise.resolve()
  }
}

const MONTHLY_COST_ALERT_MICROS = 240_000_000
const MONTHLY_COST_CAP_MICROS = 300_000_000

function createDependencies(
  totalMicros: number,
  plan: 'free' | null = 'free',
): {
  readonly dependencies: EnqueueSessionAnalysisDependencies
  readonly costs: InMemoryAnalysisCostEntriesRepository
  readonly eventBus: FakeEventBus
  readonly logger: InMemoryAnalysisLogger
  readonly queue: InMemoryProcessingQueue
} {
  const costs = new InMemoryAnalysisCostEntriesRepository(totalMicros)
  const eventBus = new FakeEventBus()
  const logger = new InMemoryAnalysisLogger()
  const queue = new InMemoryProcessingQueue()

  return {
    dependencies: {
      accounts: new InMemoryAccountsPort(plan),
      clock: new ControllableClock(new Date('2026-08-21T15:30:00.000Z')),
      costs,
      eventPublisher: eventBus,
      idGenerator: new SequentialIdGenerator(),
      logger,
      processingQueue: queue,
    },
    costs,
    eventBus,
    logger,
    queue,
  }
}

describe('EnqueueSessionAnalysisUseCase', () => {
  it('enqueues the session below the monthly cost cap using the current calendar month', async () => {
    const { dependencies, costs, queue } = createDependencies(MONTHLY_COST_CAP_MICROS - 1)
    const useCase = new EnqueueSessionAnalysisUseCase(dependencies)

    await expect(
      useCase.execute({ sessionId: 'session-1', accountId: 'account-1' }),
    ).resolves.toBeUndefined()

    expect(queue.enqueued).toEqual([{ sessionId: 'session-1' }])
    expect(costs.receivedWindow).toEqual({
      from: new Date('2026-08-01T00:00:00.000Z'),
      to: new Date('2026-09-01T00:00:00.000Z'),
    })
  })

  it.each([MONTHLY_COST_CAP_MICROS, MONTHLY_COST_CAP_MICROS + 1])(
    'publishes a monthly cap failure without enqueueing at %i micros',
    async (totalMicros) => {
      const { dependencies, eventBus, queue } = createDependencies(totalMicros)
      const useCase = new EnqueueSessionAnalysisUseCase(dependencies)

      await expect(
        useCase.execute({ sessionId: 'session-1', accountId: 'account-1' }),
      ).resolves.toBeUndefined()

      expect(queue.enqueued).toEqual([])
      expect(eventBus.published).toHaveLength(1)
      expect(eventBus.published[0]).toMatchObject({
        eventName: 'analysis_failed',
        payload: {
          sessionId: 'session-1',
          accountId: 'account-1',
          plan: 'free',
          reason: 'monthly_cost_cap_reached',
        },
      })
    },
  )

  it('warns and enqueues above the alert threshold but below the monthly cap', async () => {
    const { dependencies, eventBus, logger, queue } = createDependencies(
      MONTHLY_COST_ALERT_MICROS + 1,
    )
    const useCase = new EnqueueSessionAnalysisUseCase(dependencies)

    await useCase.execute({ sessionId: 'session-1', accountId: 'account-1' })

    expect(queue.enqueued).toEqual([{ sessionId: 'session-1' }])
    expect(eventBus.published).toEqual([])
    expect(logger.warnings).toEqual([
      {
        context: { totalMicros: MONTHLY_COST_ALERT_MICROS + 1 },
        message: 'monthly_cost_alert_threshold_reached',
      },
    ])
  })

  it('holds the monthly cap even when the plan does not resolve', async () => {
    const { dependencies, eventBus, logger, queue } = createDependencies(
      MONTHLY_COST_CAP_MICROS,
      null,
    )
    const useCase = new EnqueueSessionAnalysisUseCase(dependencies)

    await useCase.execute({ sessionId: 'session-1', accountId: 'account-1' })

    expect(queue.enqueued).toEqual([])
    expect(eventBus.published).toEqual([])
    expect(logger.warnings).toEqual([
      {
        context: { sessionId: 'session-1', accountId: 'account-1' },
        message: 'analysis_account_missing',
      },
    ])
  })
})
