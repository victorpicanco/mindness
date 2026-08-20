import type { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionExpiration } from '@/modules/sessions/domain/services/session-expiration/index.js'

import type {
  SweepExpiredSessionsDependencies,
  SweepExpiredSessionsInput,
  SweepExpiredSessionsOutput,
} from './types.js'

export class SweepExpiredSessionsUseCase {
  constructor(private readonly dependencies: SweepExpiredSessionsDependencies) {}

  async execute(input: SweepExpiredSessionsInput = {}): Promise<SweepExpiredSessionsOutput> {
    const now = this.dependencies.clock.now()
    const sessions = await this.dependencies.sessions.findExpiredInProgress(
      now,
      input.limit ?? this.dependencies.defaultLimit,
    )

    let expiredCount = 0
    for (const session of sessions) {
      if (await this.expireStaleSession(session, now)) expiredCount += 1
    }

    return { expiredCount }
  }

  private async expireStaleSession(session: Session, at: Date): Promise<boolean> {
    return this.dependencies.unitOfWork.run(async () => {
      const outcome = SessionExpiration.expire({
        session,
        reason: 'timeout',
        at,
        eventIds: [
          this.dependencies.idGenerator.generate(),
          this.dependencies.idGenerator.generate(),
        ],
      })
      if (!outcome.expired) return false

      await this.dependencies.sessions.save(session)
      await this.dependencies.quota.releaseReservation({ sessionId: session.id })
      for (const event of outcome.events) {
        await this.dependencies.eventPublisher.publish(event)
      }

      return true
    })
  }
}

export type {
  SweepExpiredSessionsDependencies,
  SweepExpiredSessionsInput,
  SweepExpiredSessionsOutput,
} from './types.js'
