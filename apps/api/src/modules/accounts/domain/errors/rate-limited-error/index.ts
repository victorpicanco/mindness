import { TooManyRequestsError } from '@/shared/errors/categories/too-many-requests-error/index.js'

export type RateLimitedOperation = 'authentication' | 'email_delivery'

export class RateLimitedError extends TooManyRequestsError {
  readonly code = 'accounts.RATE_LIMITED'

  constructor(operation: RateLimitedOperation, options?: { cause?: unknown }) {
    super('Too many attempts', { context: { operation }, cause: options?.cause })
  }
}
