import { UnauthorizedError } from '@/shared/errors/categories/unauthorized-error/index.js'

import type { AuthenticationRejectionReason } from '../authentication-rejected-error/index.js'

const EMAIL_UNCONFIRMED: AuthenticationRejectionReason = 'email_unconfirmed'

export class EmailNotConfirmedError extends UnauthorizedError {
  readonly code = 'accounts.EMAIL_NOT_CONFIRMED'
  readonly reason = EMAIL_UNCONFIRMED

  constructor(options?: { cause?: unknown }) {
    super('Email address is not confirmed', {
      context: { reason: EMAIL_UNCONFIRMED },
      cause: options?.cause,
    })
  }
}
