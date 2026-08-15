import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class InvalidAccountValueError extends UnprocessableError {
  readonly code = 'accounts.INVALID_ACCOUNT_VALUE'

  constructor(field: string) {
    super('Account value is invalid', { context: { field } })
  }
}
