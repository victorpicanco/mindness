import { ValidationError } from '@/shared/errors/categories/validation-error/index.js'

export interface FieldIssue {
  readonly field: string
  readonly message: string
}

export class ValidationFailedError extends ValidationError {
  readonly code = 'shared.VALIDATION_FAILED'

  constructor(issues: FieldIssue[]) {
    super('Request validation failed', { context: { issues } })
  }
}
