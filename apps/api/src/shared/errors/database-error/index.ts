import type { ErrorContext } from '@/shared/errors/base-error/index.js'
import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class DatabaseError extends InfrastructureError {
  readonly code = 'shared.DATABASE_ERROR'

  constructor(message: string, options?: { cause?: unknown; context?: ErrorContext }) {
    super(message, options)
  }
}
