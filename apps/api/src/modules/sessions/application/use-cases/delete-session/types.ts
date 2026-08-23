import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface DeleteSessionInput {
  readonly accountId: string
  readonly sessionId: string
}

export interface DeleteSessionDependencies {
  readonly sessions: Pick<SessionsRepository, 'findById' | 'markDeleted'>
  readonly accounts: Pick<AccountsPort, 'findProfile'>
  readonly clock: Clock
  readonly idGenerator: IdGenerator
  readonly eventPublisher: EventPublisher
}
