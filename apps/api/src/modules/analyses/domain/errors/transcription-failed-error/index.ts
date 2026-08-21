import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import type { BaseErrorOptions } from '@/shared/errors/base-error/index.js'

export class TranscriptionFailedError extends InfrastructureError {
  readonly code = 'analyses.TRANSCRIPTION_FAILED'

  constructor(reason: string, options?: Pick<BaseErrorOptions, 'cause'>) {
    super('Transcription failed', { context: { reason }, cause: options?.cause })
  }
}
