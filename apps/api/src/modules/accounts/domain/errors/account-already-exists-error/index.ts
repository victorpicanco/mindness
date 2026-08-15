import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'

export class AccountAlreadyExistsError extends ConflictError {
  readonly code = 'accounts.ACCOUNT_ALREADY_EXISTS'

  constructor(fields: string[]) {
    super('Account already exists', { context: { fields } })
  }
}
