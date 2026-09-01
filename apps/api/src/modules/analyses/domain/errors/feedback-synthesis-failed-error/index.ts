import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import type { BaseErrorOptions } from '@/shared/errors/base-error/index.js'

export class FeedbackSynthesisFailedError extends InfrastructureError {
  readonly code = 'analyses.FEEDBACK_SYNTHESIS_FAILED'

  constructor(reason: string, options?: Pick<BaseErrorOptions, 'cause'>) {
    super('Feedback synthesis failed', { context: { reason }, cause: options?.cause })
  }
}
