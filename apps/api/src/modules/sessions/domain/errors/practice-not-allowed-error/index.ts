import { ForbiddenError } from '@/shared/errors/categories/forbidden-error/index.js'

export class PracticeNotAllowedError extends ForbiddenError {
  readonly code = 'sessions.PRACTICE_NOT_ALLOWED'

  constructor(accountId: string) {
    super('Practice is not allowed without a current consent', { context: { accountId } })
  }
}
