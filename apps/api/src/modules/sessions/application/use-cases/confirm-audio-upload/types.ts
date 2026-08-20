import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type { AudioValidationPort } from '@/modules/sessions/domain/ports/audio-validation-port/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface ConfirmAudioUploadInput {
  readonly accountId: string
  readonly sessionId: string
}

export interface ConfirmAudioUploadDependencies {
  readonly sessions: SessionsRepository
  readonly audioStorage: AudioStoragePort
  readonly audioValidation: AudioValidationPort
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly clock: Clock
  readonly unitOfWork: UnitOfWork
}
