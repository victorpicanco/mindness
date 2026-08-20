import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionExpiration } from '@/modules/sessions/domain/services/session-expiration/index.js'

import type { ExpireSessionDependencies, ExpireSessionInput } from './types.js'

export class ExpireSessionUseCase {
  constructor(private readonly dependencies: ExpireSessionDependencies) {}

  async execute(input: ExpireSessionInput): Promise<void> {
    await this.dependencies.unitOfWork.run(async () => {
      const session = await this.dependencies.sessions.findById(input.sessionId)

      if (session === null || session.accountId !== input.accountId) {
        throw new SessionNotFoundError(input.sessionId)
      }

      const outcome = SessionExpiration.expire({
        session,
        reason: input.reason,
        at: this.dependencies.clock.now(),
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

export type { ExpireSessionDependencies, ExpireSessionInput } from './types.js'
