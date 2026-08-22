import type { ErrorContext } from '@/shared/errors/base-error/index.js'
import { InfrastructureError } from '@/shared/errors/infrastructure-error/index.js'

export class EventHandlerFailedError extends InfrastructureError {
  readonly code = 'shared.EVENT_HANDLER_FAILED'

  constructor(options: { readonly context: ErrorContext; readonly cause: unknown }) {
    super('Event handler failed', options)
  }
}
