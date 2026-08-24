import { ForbiddenError } from '@/shared/errors/categories/forbidden-error/index.js'

export class SignUpNotAllowedError extends ForbiddenError {
  readonly code = 'accounts.SIGN_UP_NOT_ALLOWED'

  constructor(options?: { cause?: unknown }) {
    super('Sign-up is not available for this address', { cause: options?.cause })
  }
}
