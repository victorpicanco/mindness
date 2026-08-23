import { AudioUnavailableError } from '@/modules/sessions/domain/errors/audio-unavailable-error/index.js'
import { SessionNotFoundError } from '@/modules/sessions/domain/errors/session-not-found-error/index.js'
import { AudioPlaybackWindow } from '@/modules/sessions/domain/services/audio-playback-window/index.js'

import type {
  RequestAudioPlaybackUrlDependencies,
  RequestAudioPlaybackUrlInput,
  RequestAudioPlaybackUrlOutput,
} from './types.js'

export class RequestAudioPlaybackUrlUseCase {
  constructor(private readonly dependencies: RequestAudioPlaybackUrlDependencies) {}

  async execute(input: RequestAudioPlaybackUrlInput): Promise<RequestAudioPlaybackUrlOutput> {
    const session = await this.dependencies.sessions.findById(input.sessionId)
    if (session === null || session.accountId !== input.accountId || session.state === 'deleted') {
      throw new SessionNotFoundError(input.sessionId)
    }
    if (session.audio === null) throw new AudioUnavailableError(input.sessionId)

    const objectSize = await this.dependencies.audioStorage.getObjectSize(session.audio.storagePath)
    if (objectSize === null) throw new AudioUnavailableError(input.sessionId)

    const window = AudioPlaybackWindow.from(this.dependencies.clock.now())
    const signedUrl = await this.dependencies.audioStorage.createDownloadUrl(
      session.audio.storagePath,
      window.expiresInSeconds,
    )

    return { signedUrl, expiresAt: window.expiresAt.toISOString() }
  }
}

export type {
  RequestAudioPlaybackUrlDependencies,
  RequestAudioPlaybackUrlInput,
  RequestAudioPlaybackUrlOutput,
} from './types.js'
