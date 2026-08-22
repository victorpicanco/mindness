import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'
import type { BaseErrorOptions } from '@/shared/errors/base-error/index.js'

export class EvaluationFailedError extends InfrastructureError {
  readonly code = 'analyses.EVALUATION_FAILED'

  constructor(reason: string, options?: Pick<BaseErrorOptions, 'cause'>) {
    super('Evaluation failed', { context: { reason }, cause: options?.cause })
  }
}
