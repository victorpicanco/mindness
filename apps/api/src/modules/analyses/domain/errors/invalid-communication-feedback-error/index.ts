import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class InvalidCommunicationFeedbackError extends UnprocessableError {
  readonly code = 'analyses.INVALID_COMMUNICATION_FEEDBACK'

  constructor(field: string) {
    super('Communication feedback is invalid', { context: { field } })
  }
}
