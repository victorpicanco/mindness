import { SessionAlreadyRunningError } from '@/modules/sessions/domain/errors/session-already-running-error/index.js'
import { ThemeUnavailableError } from '@/modules/sessions/domain/errors/theme-unavailable-error/index.js'
import { SessionStarted } from '@/modules/sessions/domain/events/session-started/index.js'
import { ThemeUnavailable } from '@/modules/sessions/domain/events/theme-unavailable/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { EventPublisher } from '@/modules/sessions/domain/ports/event-publisher/index.js'
import type { IdGenerator } from '@/modules/sessions/domain/ports/id-generator/index.js'
import type { QuotaPort } from '@/modules/sessions/domain/ports/quota-port/index.js'
import type { ThemesPort } from '@/modules/sessions/domain/ports/themes-port/index.js'
import type { UnitOfWork } from '@/modules/sessions/domain/ports/unit-of-work/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'
import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import type { ExpireSession, StartSessionInput, StartSessionOutput } from './types.js'

export interface StartSessionDependencies {
  readonly sessions: SessionsRepository
  readonly themes: ThemesPort
  readonly quota: QuotaPort
  readonly clock: Clock
  readonly eventPublisher: EventPublisher
  readonly idGenerator: IdGenerator
  readonly unitOfWork: UnitOfWork
  readonly expireSession: ExpireSession
}

export class StartSessionUseCase {
  constructor(private readonly dependencies: StartSessionDependencies) {}

  async execute(input: StartSessionInput): Promise<StartSessionOutput> {
    const activeSession = await this.dependencies.sessions.findActiveByAccountId(input.accountId)
    const now = this.dependencies.clock.now()

    if (activeSession !== null && activeSession.expiresAt.getTime() > now.getTime()) {
      throw new SessionAlreadyRunningError(activeSession.id)
    }

    if (activeSession !== null) {
      await this.dependencies.expireSession.execute({
        accountId: input.accountId,
        sessionId: activeSession.id,
        reason: 'timeout',
      })
    }

    const theme = await this.dependencies.themes.drawEligibleTheme({
      categorySlug: input.categorySlug,
      difficulty: input.difficulty,
    })
    if (theme === null) {
      await this.dependencies.eventPublisher.publish(
        ThemeUnavailable.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: now,
          accountId: input.accountId,
          categorySlug: input.categorySlug,
          difficulty: input.difficulty,
        }),
      )
      throw new ThemeUnavailableError(input.categorySlug, input.difficulty)
    }

    const sessionId = this.dependencies.idGenerator.generate()
    const reservation = await this.dependencies.quota.reserveForSession({
      accountId: input.accountId,
      sessionId,
    })
    const session = Session.start({
      sessionId,
      accountId: input.accountId,
      themeId: theme.themeId,
      configuration: SessionConfiguration.create({
        difficulty: input.difficulty,
        categorySlug: input.categorySlug,
        searchWindowMinutes: input.searchWindowMinutes,
      }),
      quotaReservationId: reservation.reservationId,
      createdAt: now,
    })

    try {
      await this.dependencies.unitOfWork.run(() => this.dependencies.sessions.save(session))
    } catch (error) {
      await this.dependencies.quota.releaseReservation({ sessionId })
      throw error
    }

    await this.dependencies.eventPublisher.publish(
      SessionStarted.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: now,
        sessionId,
        accountId: input.accountId,
        difficulty: input.difficulty,
        categorySlug: input.categorySlug,
        searchWindowMinutes: input.searchWindowMinutes,
        remaining: reservation.remaining,
      }),
    )

    return {
      sessionId,
      themeId: theme.themeId,
      expiresAt: session.expiresAt.toISOString(),
      remaining: reservation.remaining,
    }
  }
}

export type { ExpireSession, StartSessionInput, StartSessionOutput } from './types.js'
