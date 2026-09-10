import { ForbiddenError } from '@/shared/errors/categories/forbidden-error/index.js'

export class GuestTrialConsumedError extends ForbiddenError {
  readonly code = 'sessions.GUEST_TRIAL_CONSUMED'

  constructor(accountId: string, options?: { cause?: unknown }) {
    super('The guest trial of this account was already used', {
      context: { accountId },
      cause: options?.cause,
    })
  }
}
