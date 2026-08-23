import { SessionAlreadyRunningError } from '@/modules/sessions/domain/errors/session-already-running-error/index.js'
import { ThemeUnavailableError } from '@/modules/sessions/domain/errors/theme-unavailable-error/index.js'
import { SessionStarted } from '@/modules/sessions/domain/events/session-started/index.js'
import { ThemeUnavailable } from '@/modules/sessions/domain/events/theme-unavailable/index.js'
import { SessionExpiration } from '@/modules/sessions/domain/services/session-expiration/index.js'
import { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionConfiguration } from '@/modules/sessions/domain/value-objects/session-configuration/index.js'

import type { StartSessionDependencies, StartSessionInput, StartSessionOutput } from './types.js'

export class StartSessionUseCase {
  constructor(private readonly dependencies: StartSessionDependencies) {}

  async execute(input: StartSessionInput): Promise<StartSessionOutput> {
    const configuration = SessionConfiguration.create({
      difficulty: input.difficulty,
      categorySlug: input.categorySlug,
      searchWindowMinutes: input.searchWindowMinutes,
    })
    const activeSession = await this.dependencies.sessions.findActiveByAccountId(input.accountId)
    const now = this.dependencies.clock.now()

    if (activeSession !== null && activeSession.isLiveAt(now)) {
      throw new SessionAlreadyRunningError(activeSession.id)
    }
    if (activeSession !== null) await this.expireStaleSession(activeSession, now)

    const theme = await this.dependencies.themes.drawEligibleTheme({
      categorySlug: configuration.categorySlug,
      difficulty: configuration.difficulty,
    })
    if (theme === null) {
      await this.dependencies.eventPublisher.publish(
        ThemeUnavailable.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt: now,
          accountId: input.accountId,
          categorySlug: configuration.categorySlug,
          difficulty: configuration.difficulty,
        }),
      )
      throw new ThemeUnavailableError(configuration.categorySlug, configuration.difficulty)
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
      configuration,
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
        difficulty: configuration.difficulty,
        categorySlug: configuration.categorySlug,
        searchWindowMinutes: configuration.searchWindowMinutes,
        remaining: reservation.remaining,
      }),
    )

    return {
      sessionId,
      themeId: theme.themeId,
      themeTitle: theme.title,
      expiresAt: session.expiresAt.toISOString(),
      remaining: reservation.remaining,
    }
  }

  private async expireStaleSession(session: Session, at: Date): Promise<void> {
    await this.dependencies.unitOfWork.run(async () => {
      const outcome = SessionExpiration.expire({
        session,
        reason: 'timeout',
        at,
        eventIds: [
          this.dependencies.idGenerator.generate(),
          this.dependencies.idGenerator.generate(),
        ],
      })
      if (!outcome.expired) return

      await this.dependencies.sessions.save(session)
      await this.dependencies.quota.releaseReservation({ sessionId: session.id })
      for (const event of outcome.events) {
        await this.dependencies.eventPublisher.publish(event)
      }
    })
  }
}

export type { StartSessionDependencies, StartSessionInput, StartSessionOutput } from './types.js'
