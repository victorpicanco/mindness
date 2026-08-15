import { NotFoundError } from '@/shared/errors/categories/not-found-error/index.js'

export class AccountNotFoundError extends NotFoundError {
  readonly code = 'accounts.ACCOUNT_NOT_FOUND'

  constructor() {
    super('Account not found')
  }
}
