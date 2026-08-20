import { ConflictError } from '@/shared/errors/categories/conflict-error/index.js'
import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

// The lint boundary keeps `composition/` from importing `@/modules/quota`, so the fake
// reproduces the contract that matters to sessions: the code the adapter propagates untouched
// (ADR-002, T-017). Recorded as an assumed decision in the block plan.
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
