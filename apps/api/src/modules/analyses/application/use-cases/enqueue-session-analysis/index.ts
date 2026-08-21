import { AnalysisFailed } from '@/modules/analyses/domain/events/analysis-failed/index.js'

import type {
  EnqueueSessionAnalysisDependencies,
  EnqueueSessionAnalysisInput,
  EnqueueSessionAnalysisOutput,
} from './types.js'

const MONTHLY_COST_ALERT_MICROS = 240_000_000
const MONTHLY_COST_CAP_MICROS = 300_000_000

export class EnqueueSessionAnalysisUseCase {
  constructor(private readonly dependencies: EnqueueSessionAnalysisDependencies) {}

  async execute(input: EnqueueSessionAnalysisInput): Promise<EnqueueSessionAnalysisOutput> {
    const now = this.dependencies.clock.now()
    const monthlyCostMicros = await this.dependencies.costs.sumMicrosBetween(
      startOfMonth(now),
      startOfNextMonth(now),
    )

    if (monthlyCostMicros >= MONTHLY_COST_CAP_MICROS) {
      const plan = await this.dependencies.accounts.findPlan(input.accountId)
      if (plan === null) return

      await this.dependencies.eventPublisher.publish(
        AnalysisFailed.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: now,
          sessionId: input.sessionId,
          accountId: input.accountId,
          plan,
          reason: 'monthly_cost_cap_reached',
        }),
      )
      return
    }

    if (monthlyCostMicros > MONTHLY_COST_ALERT_MICROS) {
      this.dependencies.logger.warn(
        { totalMicros: monthlyCostMicros },
        'monthly_cost_alert_threshold_reached',
      )
    }

    await this.dependencies.processingQueue.enqueue({ sessionId: input.sessionId })
    return
  }
}

function startOfMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function startOfNextMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1))
}

export type {
  EnqueueSessionAnalysisDependencies,
  EnqueueSessionAnalysisInput,
  EnqueueSessionAnalysisOutput,
} from './types.js'
