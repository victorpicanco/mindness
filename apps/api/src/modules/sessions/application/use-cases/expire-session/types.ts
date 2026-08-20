import type { SessionExpiredReason } from '@/modules/sessions/domain/entities/session/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface ExpireSessionInput {
  readonly accountId: string
  readonly sessionId: string
  readonly reason: SessionExpiredReason
}

export interface ExpireSessionDependencies {
  readonly sessions: SessionsRepository
  readonly quota: QuotaPort
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
  readonly clock: Clock
}
