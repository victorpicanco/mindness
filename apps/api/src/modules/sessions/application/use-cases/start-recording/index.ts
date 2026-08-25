import type { Session } from '@/modules/sessions/domain/entities/session/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import { SessionExpiration } from '@/modules/sessions/domain/services/session-expiration/index.js'

import type {
  StartRecordingDependencies,
  StartRecordingInput,
  StartRecordingOutput,
} from './types.js'

export class StartRecordingUseCase {
  constructor(private readonly dependencies: StartRecordingDependencies) {}

  async execute(input: StartRecordingInput): Promise<StartRecordingOutput> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.accountId !== input.accountId) {
      throw new SessionNotFoundError(input.sessionId)
    }

    const now = this.dependencies.clock.now()
    if (session.hasElapsedAt(now)) {
      await this.expireStaleSession(session, now)
      throw new SessionNotInProgressError('expired')
    }

    const recordingStartedAt = session.startRecording(now)
    await this.dependencies.unitOfWork.run(() => this.dependencies.sessions.save(session))

    return {
      recordingStartedAt: recordingStartedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
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
  StartRecordingDependencies,
  StartRecordingInput,
  StartRecordingOutput,
} from './types.js'
