import { UnprocessableError } from '@/shared/errors/categories/unprocessable-error/index.js'

export class InvalidQuotaValueError extends UnprocessableError {
  readonly code = 'quota.INVALID_QUOTA_VALUE'

  constructor(field: string) {
    super('Quota value is invalid', { context: { field } })
  }
}
