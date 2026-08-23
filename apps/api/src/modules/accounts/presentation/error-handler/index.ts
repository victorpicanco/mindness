import type { FastifyInstance } from 'fastify'

import { registerErrorHandler } from '@/shared/http/error-handler/index.js'

export function registerAccountsErrorHandler(app: FastifyInstance): void {
  registerErrorHandler(app)
}
