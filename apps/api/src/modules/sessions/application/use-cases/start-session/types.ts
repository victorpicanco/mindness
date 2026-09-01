import type { AccountsPort } from '@/modules/sessions/domain/ports/accounts-port/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface StartSessionInput {
  readonly accountId: string
  readonly difficulty: string
  readonly categorySlug: string
  readonly searchWindowMinutes: number
}

export interface StartSessionOutput {
  readonly createdAt: string
  readonly serverNow: string
  readonly sessionId: string
  readonly themeId: string
  readonly themeTitle: string
  readonly expiresAt: string
  readonly researchEndsAt: string
}

export interface StartSessionDependencies {
  readonly sessions: SessionsRepository
  readonly themes: ThemesPort
  readonly accounts: Pick<AccountsPort, 'canStartPractice'>
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
}
