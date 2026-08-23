import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'
import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class FakeQuotaExhaustedError extends ConflictError {
  readonly code = 'quota.QUOTA_EXHAUSTED'

  constructor() {
    super('Quota is exhausted')
  }
}

export class FakeStorageObjectNotFoundError extends InfrastructureError {
  readonly code = 'sessions.FAKE_STORAGE_OBJECT_NOT_FOUND'

  constructor() {
    super('Audio object was not found')
  }
}
