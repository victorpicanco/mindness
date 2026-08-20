import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class AudioStorageProviderError extends InfrastructureError {
  readonly code = 'sessions.AUDIO_STORAGE_PROVIDER_ERROR'

  constructor(operation: string, cause?: unknown) {
    super('Audio storage provider failed', {
      context: { operation },
      ...(cause === undefined ? {} : { cause }),
    })
  }
}
