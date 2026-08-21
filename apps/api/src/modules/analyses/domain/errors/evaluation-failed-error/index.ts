import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class EvaluationFailedError extends InfrastructureError {
  readonly code = 'analyses.EVALUATION_FAILED'

  constructor(reason: string) {
    super('Evaluation failed', { context: { reason } })
  }
}
