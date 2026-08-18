import type { FastifyInstance } from 'fastify'

import { createQuotaContainer, type QuotaContainer, type QuotaModuleDeps } from './container.js'

export function registerQuotaModule(_app: FastifyInstance, deps: QuotaModuleDeps): QuotaContainer {
  return createQuotaContainer(deps)
}
