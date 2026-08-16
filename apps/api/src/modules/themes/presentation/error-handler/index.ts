import type { FastifyInstance } from 'fastify'

import { registerErrorHandler } from '@/shared/http/error-handler/index.js'

export function registerThemesErrorHandler(app: FastifyInstance): void {
  registerErrorHandler(app)
}
