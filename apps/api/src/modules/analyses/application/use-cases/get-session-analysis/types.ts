import type { AccountsPort } from '@/modules/analyses/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/analyses/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/analyses/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/analyses/domain/ports/id-generator/index.js'
import type { SessionsPort } from '@/modules/analyses/domain/ports/sessions-port/index.js'
import type { AnalysesRepository } from '@/modules/analyses/domain/repositories/analyses-repository/index.js'
import type { TranscriptionsRepository } from '@/modules/analyses/domain/repositories/transcriptions-repository/index.js'
import type { PillarName } from '@/modules/analyses/domain/services/guidance-selector/types.js'

export interface GetSessionAnalysisInput {
  readonly sessionId: string
  readonly accountId: string
}

export interface GetSessionAnalysisOutput {
  readonly sessionId: string
  readonly scores: {
    readonly clarity: number
    readonly rhythm: number
    readonly fluency: number
    readonly mastery: number
    readonly total: number
  }
  readonly guidance: readonly { readonly pillar: PillarName; readonly text: string }[]
  readonly transcript: string
  readonly analyzedAt: string
}

export interface GetSessionAnalysisDependencies {
  readonly analyses: Pick<AnalysesRepository, 'findBySessionId' | 'markFirstView'>
  readonly transcriptions: Pick<TranscriptionsRepository, 'findBySessionId'>
  readonly sessions: Pick<SessionsPort, 'isReadableByAccount'>
  readonly accounts: Pick<AccountsPort, 'findPlan'>
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
}
