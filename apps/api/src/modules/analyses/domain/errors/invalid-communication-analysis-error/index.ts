import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class InvalidCommunicationAnalysisError extends UnprocessableError {
  readonly code = 'analyses.INVALID_COMMUNICATION_ANALYSIS'

  constructor(field: string) {
    super('Communication analysis is invalid', { context: { field } })
  }
}
