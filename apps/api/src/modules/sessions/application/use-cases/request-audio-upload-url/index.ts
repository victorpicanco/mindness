import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'
import { AudioObjectPath } from '@/modules/sessions/domain/value-objects/audio-object-path/index.js'

import type {
  RequestAudioUploadUrlDependencies,
  RequestAudioUploadUrlInput,
  RequestAudioUploadUrlOutput,
} from './types.js'

export class RequestAudioUploadUrlUseCase {
  constructor(private readonly dependencies: RequestAudioUploadUrlDependencies) {}

  async execute(input: RequestAudioUploadUrlInput): Promise<RequestAudioUploadUrlOutput> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.accountId !== input.accountId) {
      throw new SessionNotFoundError(input.sessionId)
    }

    // D-05: the credential is only handed out for a session that is in progress *and* still
    // inside its fifteen-minute window.
    const now = this.dependencies.clock.now()
    if (!session.isLiveAt(now)) {
      throw new SessionNotInProgressError(session.hasElapsedAt(now) ? 'expired' : session.state)
    }

    const path = AudioObjectPath.forSession({
      accountId: input.accountId,
      sessionId: input.sessionId,
    }).value
    const credential = await this.dependencies.audioStorage.createUploadUrl(path)

    return { ...credential, path }
  }
}

export type {
  RequestAudioUploadUrlDependencies,
  RequestAudioUploadUrlInput,
  RequestAudioUploadUrlOutput,
} from './types.js'
