import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import type {
  SearchWindowMinutes,
  SessionDifficulty,
} from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

export interface GetActiveSessionInput {
  readonly accountId: string
}

export interface GetActiveSessionOutput {
  readonly sessionId: string
  readonly themeId: string
  readonly themeTitle: string
  readonly configuration: {
    readonly difficulty: SessionDifficulty
    readonly categorySlug: string
    readonly searchWindowMinutes: SearchWindowMinutes
  }
  readonly createdAt: string
  readonly serverNow: string
  readonly researchEndsAt: string
  readonly expiresAt: string
  readonly recordingStartedAt: string | null
}

export interface GetActiveSessionDependencies {
  readonly sessions: SessionsRepository
  readonly quota: QuotaPort
  readonly themes: ThemesPort
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}
