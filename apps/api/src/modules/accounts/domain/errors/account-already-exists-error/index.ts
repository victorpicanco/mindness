import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class AccountAlreadyExistsError extends ConflictError {
  readonly code = 'accounts.ACCOUNT_ALREADY_EXISTS'

  constructor(fields: string[], options?: { cause?: unknown }) {
    super('Account already exists', { context: { fields }, cause: options?.cause })
  }
}
