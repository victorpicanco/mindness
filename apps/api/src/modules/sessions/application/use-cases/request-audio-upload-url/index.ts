import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { SessionNotInProgressError } from '@/modules/sessions/domain/errors/session-not-in-progress-error/index.js'

import type {
  RequestAudioUploadUrlDependencies,
  RequestAudioUploadUrlInput,
  RequestAudioUploadUrlOutput,
} from './types.js'

function audioPath(accountId: string, sessionId: string): string {
  return `${accountId}/${sessionId}/audio`
}

export class RequestAudioUploadUrlUseCase {
  constructor(private readonly dependencies: RequestAudioUploadUrlDependencies) {}

  async execute(input: RequestAudioUploadUrlInput): Promise<RequestAudioUploadUrlOutput> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.accountId !== input.accountId) {
      throw new SessionNotFoundError(input.sessionId)
    }
    if (session.state !== 'in_progress') throw new SessionNotInProgressError(session.state)

    const path = audioPath(input.accountId, input.sessionId)
    const credential = await this.dependencies.audioStorage.createUploadUrl(path)

    return { ...credential, path }
  }
}

export type {
  RequestAudioUploadUrlDependencies,
  RequestAudioUploadUrlInput,
  RequestAudioUploadUrlOutput,
} from './types.js'
