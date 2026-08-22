import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class MalformedEvaluationError extends InfrastructureError {
  readonly code = 'analyses.MALFORMED_EVALUATION'

  constructor(field: string) {
    super('Evaluation response is malformed', { context: { field } })
  }
}
