import type { FastifyInstance } from 'fastify'

import { registerErrorHandler } from '@/shared/http/error-handler/index.js'

// LAW-005.7 requires the module to own the handler of its scope; every analyses error is a
// BaseError with its own httpStatus, so the shared translation is already the whole mapping.
export function registerAnalysesErrorHandler(app: FastifyInstance): void {
  registerErrorHandler(app)
}
