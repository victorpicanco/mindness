import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class AudioValidationProviderError extends InfrastructureError {
  readonly code = 'sessions.AUDIO_VALIDATION_PROVIDER_ERROR'

  constructor(operation: string, cause?: unknown) {
    super('Audio validation provider failed', {
      context: { operation },
      ...(cause === undefined ? {} : { cause }),
    })
  }
}
