import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { MicrophonePermissionDenied } from '@/modules/sessions/domain/events/microphone-permission-denied/index.js'
import { SessionExpired } from '@/modules/sessions/domain/events/session-expired/index.js'

import type { ExpireSessionDependencies, ExpireSessionInput } from './types.js'

export class ExpireSessionUseCase {
  constructor(private readonly dependencies: ExpireSessionDependencies) {}

  async execute(input: ExpireSessionInput): Promise<void> {
    await this.dependencies.unitOfWork.run(async () => {
      const session = await this.dependencies.sessions.findById(input.sessionId)

      if (session === null || session.accountId !== input.accountId) {
        throw new SessionNotFoundError(input.sessionId)
      }
      if (session.state !== 'in_progress') return

      const stoppedAtStage = session.state
      const occurredAt = this.dependencies.clock.now()
      session.expire(input.reason, occurredAt)
      await this.dependencies.sessions.save(session)
      await this.dependencies.quota.releaseReservation({ sessionId: session.id })
      await this.dependencies.eventPublisher.publish(
        SessionExpired.create({
          eventId: this.dependencies.idGenerator.generate(),
          occurredAt,
          sessionId: session.id,
          accountId: session.accountId,
          stoppedAtStage,
        }),
      )

      if (input.reason === 'microphone_permission_denied') {
        await this.dependencies.eventPublisher.publish(
          MicrophonePermissionDenied.create({
            eventId: this.dependencies.idGenerator.generate(),
            occurredAt,
            sessionId: session.id,
            accountId: session.accountId,
          }),
        )
      }
    })
  }
}

export type { ExpireSessionDependencies, ExpireSessionInput } from './types.js'
