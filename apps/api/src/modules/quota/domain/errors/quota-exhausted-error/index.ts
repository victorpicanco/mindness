import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class QuotaExhaustedError extends ConflictError {
  readonly code = 'quota.QUOTA_EXHAUSTED'

  constructor(accountId: string, renewsAt: Date) {
    super('Quota is exhausted', { context: { accountId, renewsAt: renewsAt.toISOString() } })
  }
}
