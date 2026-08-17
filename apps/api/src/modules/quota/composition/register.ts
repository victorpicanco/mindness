import type { FastifyInstance } from 'fastify'

import type { QuotaPublicApi } from '@/modules/quota/presentation/public-api/index.js'

import { createQuotaContainer, type QuotaModuleDeps } from './container.js'

export interface QuotaModule {
  readonly publicApi: QuotaPublicApi
}

export function registerQuotaModule(_app: FastifyInstance, deps: QuotaModuleDeps): QuotaModule {
  const container = createQuotaContainer(deps)

  return { publicApi: container.publicApi }
}
