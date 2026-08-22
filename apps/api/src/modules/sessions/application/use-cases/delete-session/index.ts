import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionAuthenticationRejectedError } from '@/modules/sessions/domain/errors/session-authentication-rejected-error/index.js'
import { SessionDeleted } from '@/modules/sessions/domain/events/session-deleted/index.js'

import type { DeleteSessionDependencies, DeleteSessionInput } from './types.js'

export class DeleteSessionUseCase {
  constructor(private readonly dependencies: DeleteSessionDependencies) {}

  async execute(input: DeleteSessionInput): Promise<void> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.accountId !== input.accountId || session.state === 'deleted') {
      throw new SessionNotFoundError(input.sessionId)
    }

    const profile = await this.dependencies.accounts.findProfile(input.accountId)
    if (profile === null) throw new SessionAuthenticationRejectedError()

    const at = this.dependencies.clock.now()
    session.delete(at)
    await this.dependencies.sessions.save(session)
    await this.dependencies.eventPublisher.publish(
      SessionDeleted.create({
        eventId: this.dependencies.idGenerator.generate(),
        occurredAt: at,
        sessionId: session.id,
        accountId: input.accountId,
        plan: profile.plan,
      }),
    )
  }
}

export type { DeleteSessionDependencies, DeleteSessionInput } from './types.js'
