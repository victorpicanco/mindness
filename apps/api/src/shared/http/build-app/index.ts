import fastifySwagger from '@fastify/swagger'
import { TypeBoxValidatorCompiler, type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import Fastify, { type FastifyBaseLogger } from 'fastify'

import { registerErrorHandler } from '@/shared/http/error-handler/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'

export interface BuildAppDeps {
  readonly logger: FastifyBaseLogger
  // Only true behind a proxy that overwrites the forwarded header: a client
  // reaching the process directly can otherwise forge its own address and walk
  // past the per-IP rate limit of ADR-007.
  readonly trustProxy?: boolean
}

export function buildApp(deps: BuildAppDeps) {
  const requestIdGenerator = new UuidGenerator()

  const app = Fastify({
    loggerInstance: deps.logger,
    genReqId: () => requestIdGenerator.generate(),
    trustProxy: deps.trustProxy ?? false,
  }).withTypeProvider<TypeBoxTypeProvider>()

  app.setValidatorCompiler(TypeBoxValidatorCompiler)

  void app.register(fastifySwagger, {
    openapi: { openapi: '3.1.0', info: { title: 'mindness', version: '1.0.0' } },
  })

  registerErrorHandler(app)

  return app
}
