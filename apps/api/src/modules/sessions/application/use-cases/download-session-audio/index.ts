import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import type {
  DownloadSessionAudioDependencies,
  DownloadSessionAudioInput,
  DownloadSessionAudioOutput,
} from './types.js'

export class DownloadSessionAudioUseCase {
  constructor(private readonly dependencies: DownloadSessionAudioDependencies) {}

  async execute(input: DownloadSessionAudioInput): Promise<DownloadSessionAudioOutput> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.audio === null) throw new SessionNotFoundError(input.sessionId)

    return {
      bytes: await this.dependencies.audioStorage.downloadObject(session.audio.storagePath),
      contentType: session.audio.contentType,
      durationSeconds: session.audio.durationSeconds,
    }
  }
}
export type { DownloadSessionAudioInput, DownloadSessionAudioOutput } from './types.js'
