import { UnauthorizedError } from '@/shared/errors/categories/unauthorized-error/index.js'

export class AnalysisAuthenticationRejectedError extends UnauthorizedError {
  readonly code = 'analyses.AUTHENTICATION_REJECTED'

  constructor() {
    super('Authentication rejected')
  }
}
