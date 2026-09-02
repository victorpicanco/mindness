import type { SpeechFeedback } from '@/modules/analyses/domain/ports/evaluation-port/index.js'
import type { AccountsPort } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/analyses/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/analyses/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { SessionsPort } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { AnalysesRepository } from '@/modules/analyses/domain/repositories/analyses-repository/index.js'
import type { TranscriptionsRepository } from '@/modules/analyses/domain/repositories/transcriptions-repository/index.js'

export interface GetSessionAnalysisInput {
  readonly sessionId: string
  readonly accountId: string
}

export interface GetSessionAnalysisOutput {
  readonly sessionId: string
  readonly feedback: SpeechFeedback
  readonly transcript: string
  readonly analyzedAt: string
}

export interface GetSessionAnalysisDependencies {
  readonly analyses: Pick<AnalysesRepository, 'findBySessionId' | 'markFirstView'>
  readonly transcriptions: Pick<TranscriptionsRepository, 'findBySessionId'>
  readonly sessions: Pick<SessionsPort, 'checkAnalysisAccess'>
  readonly accounts: Pick<AccountsPort, 'findPlan'>
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
}
