import type { FastifyInstance } from 'fastify'

import { registerErrorHandler } from '@/shared/http/error-handler/index.js'

export function registerAnalysesErrorHandler(app: FastifyInstance): void {
  registerErrorHandler(app)
}
