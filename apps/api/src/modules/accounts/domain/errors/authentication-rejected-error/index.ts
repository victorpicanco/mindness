import { UnauthorizedError } from '@/shared/errors/categories/unauthorized-error/index.js'

export type AuthenticationRejectionReason =
  'email_unconfirmed' | 'google_failed' | 'invalid_credentials' | 'invalid_token'

export class AuthenticationRejectedError extends UnauthorizedError {
  readonly code = 'accounts.AUTHENTICATION_REJECTED'

  constructor(
    readonly reason: AuthenticationRejectionReason,
    options?: { cause?: unknown },
  ) {
    super('Authentication rejected', { context: { reason }, cause: options?.cause })
  }
}
