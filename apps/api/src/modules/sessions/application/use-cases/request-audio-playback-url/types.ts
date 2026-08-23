import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type { Clock } from '@/modules/sessions/domain/ports/clock/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface RequestAudioPlaybackUrlInput {
  readonly accountId: string
  readonly sessionId: string
}

export interface RequestAudioPlaybackUrlOutput {
  readonly signedUrl: string
  readonly expiresAt: string
}

export interface RequestAudioPlaybackUrlDependencies {
  readonly sessions: Pick<SessionsRepository, 'findById'>
  readonly audioStorage: Pick<AudioStoragePort, 'createDownloadUrl' | 'getObjectSize'>
  readonly clock: Clock
}
