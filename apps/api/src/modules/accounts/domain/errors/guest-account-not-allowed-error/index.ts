import { ForbiddenError } from '@/shared/errors/categories/forbidden-error/index.js'

export class GuestAccountNotAllowedError extends ForbiddenError {
  readonly code = 'accounts.GUEST_ACCOUNT_NOT_ALLOWED'

  constructor(operation: string) {
    super('A guest account cannot use this operation', { context: { operation } })
  }
}
