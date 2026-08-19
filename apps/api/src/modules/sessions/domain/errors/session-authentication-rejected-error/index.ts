import { UnauthorizedError } from '@/shared/errors/categories/unauthorized-error/index.js'

export class SessionAuthenticationRejectedError extends UnauthorizedError {
  readonly code = 'sessions.AUTHENTICATION_REJECTED'

  constructor() {
    super('Authentication rejected')
  }
}
