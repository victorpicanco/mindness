import type { Clock } from '@/modules/analyses/domain/ports/clock/index.js'
import type { ProcessingQueuePort } from '@/modules/analyses/domain/ports/processing-queue-port/index.js'
import type { SessionsPort } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { AnalysesRepository } from '@/modules/analyses/domain/repositories/analyses-repository/index.js'

export interface ReconcileOrphanAnalysesInput {
  readonly staleAfterMs: number
  readonly limit: number
}

export interface ReconcileOrphanAnalysesOutput {
  readonly reconciledCount: number
}

export interface ReconcileOrphanAnalysesDependencies {
  readonly sessions: SessionsPort
  readonly analyses: Pick<AnalysesRepository, 'findBySessionId'>
  readonly processingQueue: ProcessingQueuePort
  readonly clock: Clock
}
