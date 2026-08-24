import { ForbiddenError } from '@/shared/errors/categories/forbidden-error/index.js'

export class AccountBlockedError extends ForbiddenError {
  readonly code = 'accounts.ACCOUNT_BLOCKED'

  constructor(options?: { cause?: unknown }) {
    super('Account is blocked', { cause: options?.cause })
  }
}
