import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class AuthProviderError extends InfrastructureError {
  readonly code = 'accounts.AUTH_PROVIDER_ERROR'

  constructor(options?: { cause?: unknown }) {
    super('Authentication provider failed', { cause: options?.cause })
  }
}
