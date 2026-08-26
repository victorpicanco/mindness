import type { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionExpiration } from '@/modules/sessions/domain/services/session-expiration/index.js'

import type {
  GetActiveSessionDependencies,
  GetActiveSessionInput,
  GetActiveSessionOutput,
} from './types.js'

export class GetActiveSessionUseCase {
  constructor(private readonly dependencies: GetActiveSessionDependencies) {}

  async execute(input: GetActiveSessionInput): Promise<GetActiveSessionOutput | null> {
    const session = await this.dependencies.sessions.findActiveByAccountId(input.accountId)

    if (session === null) return null

    const now = this.dependencies.clock.now()
    if (session.hasElapsedAt(now)) {
      await this.expireStaleSession(session, now)
      return null
    }

    const theme = await this.dependencies.themes.findThemeById(session.themeId)

    return {
      sessionId: session.id,
      themeId: session.themeId,
      themeTitle: theme.title,
      configuration: {
        difficulty: session.configuration.difficulty,
        categorySlug: session.configuration.categorySlug,
        searchWindowMinutes: session.configuration.searchWindowMinutes,
      },
      createdAt: session.createdAt.toISOString(),
      serverNow: now.toISOString(),
      researchEndsAt: session.researchEndsAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
      recordingStartedAt: session.recordingStartedAt?.toISOString() ?? null,
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

export type {
  GetActiveSessionDependencies,
  GetActiveSessionInput,
  GetActiveSessionOutput,
} from './types.js'
