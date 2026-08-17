import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class QuotaAccountNotFoundError extends NotFoundError {
  readonly code = 'quota.QUOTA_ACCOUNT_NOT_FOUND'

  constructor(accountId: string) {
    super('Quota account not found', { context: { accountId } })
  }
}
