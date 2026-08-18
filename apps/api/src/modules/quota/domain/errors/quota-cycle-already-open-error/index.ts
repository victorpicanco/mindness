import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class QuotaCycleAlreadyOpenError extends ConflictError {
  readonly code = 'quota.QUOTA_CYCLE_ALREADY_OPEN'

  constructor(accountId: string, startsAt: Date, options?: { readonly cause?: unknown }) {
    super('Quota cycle is already open', {
      cause: options?.cause,
      context: { accountId, startsAt: startsAt.toISOString() },
    })
  }
}
