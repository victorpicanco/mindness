import type { AudioStoragePort } from '@/modules/sessions/domain/ports/audio-storage-port/index.js'
import type { SessionsRepository } from '@/modules/sessions/domain/repositories/sessions-repository/index.js'

export interface RequestAudioUploadUrlInput {
  readonly accountId: string
  readonly sessionId: string
}

export interface RequestAudioUploadUrlOutput {
  readonly uploadUrl: string
  readonly token: string
  readonly path: string
}

export interface RequestAudioUploadUrlDependencies {
  readonly sessions: SessionsRepository
  readonly audioStorage: AudioStoragePort
}
