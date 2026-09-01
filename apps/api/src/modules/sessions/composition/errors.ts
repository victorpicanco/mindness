import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class FakeStorageObjectNotFoundError extends InfrastructureError {
  readonly code = 'sessions.FAKE_STORAGE_OBJECT_NOT_FOUND'

  constructor() {
    super('Audio object was not found')
  }
}
