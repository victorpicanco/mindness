import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import type { DownloadSessionAudioDependencies, DownloadSessionAudioInput } from './types.js'

export class DownloadSessionAudioUseCase {
  constructor(private readonly dependencies: DownloadSessionAudioDependencies) {}

  async execute(input: DownloadSessionAudioInput): Promise<Buffer> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.audio === null) throw new SessionNotFoundError(input.sessionId)
    return this.dependencies.audioStorage.downloadObject(session.audio.storagePath)
  }
}
export type { DownloadSessionAudioInput } from './types.js'
