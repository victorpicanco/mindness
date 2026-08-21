import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface DownloadSessionAudioInput {
  readonly sessionId: string
}
export interface DownloadSessionAudioDependencies {
  readonly sessions: Pick<SessionsRepository, 'findById'>
  readonly audioStorage: Pick<AudioStoragePort, 'downloadObject'>
}
