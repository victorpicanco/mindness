import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface StartRecordingInput {
  readonly accountId: string
  readonly sessionId: string
}

export interface StartRecordingOutput {
  readonly recordingStartedAt: string
  readonly expiresAt: string
}

export interface StartRecordingDependencies {
  readonly sessions: SessionsRepository
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}
