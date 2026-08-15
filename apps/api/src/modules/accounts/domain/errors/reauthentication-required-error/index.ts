import { UnauthorizedError } from '@/shared/errors/categories/unauthorized-error/index.js'

const MAXIMUM_AGE_SECONDS = 300

export class ReauthenticationRequiredError extends UnauthorizedError {
  readonly code = 'accounts.REAUTHENTICATION_REQUIRED'

  constructor() {
    super('Recent authentication is required', {
      context: { maximumAgeSeconds: MAXIMUM_AGE_SECONDS },
    })
  }
}
