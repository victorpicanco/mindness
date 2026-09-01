import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import type { BaseErrorOptions } from '@/shared/errors/base-error/index.js'

export class AudioPreparationFailedError extends InfrastructureError {
  readonly code = 'analyses.AUDIO_PREPARATION_FAILED'

  constructor(reason: string, options?: Pick<BaseErrorOptions, 'cause'>) {
    super('Audio preparation failed', { context: { reason }, cause: options?.cause })
  }
}
