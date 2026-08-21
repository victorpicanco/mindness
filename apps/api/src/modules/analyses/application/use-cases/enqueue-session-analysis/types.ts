import type { AccountsPort } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/analyses/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/analyses/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { ProcessingQueuePort } from '@/modules/analyses/domain/ports/processing-queue-port/index.js'
import type { AnalysisCostEntriesRepository } from '@/modules/analyses/domain/repositories/analysis-cost-entries-repository/index.js'

export interface MonthlyCostAlertLogger {
  warn(context: { readonly totalMicros: number }, message: string): void
}

export interface EnqueueSessionAnalysisDependencies {
  readonly accounts: AccountsPort
  readonly clock: Clock
  readonly costs: AnalysisCostEntriesRepository
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly logger: MonthlyCostAlertLogger
  readonly processingQueue: ProcessingQueuePort
}

export interface EnqueueSessionAnalysisInput {
  readonly sessionId: string
  readonly accountId: string
}

export type EnqueueSessionAnalysisOutput = void
