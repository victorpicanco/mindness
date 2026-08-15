import fastifySwagger from '@fastify/swagger'
import { TypeBoxValidatorCompiler, type TypeBoxTypeProvider } from '@fastify/type-provider-typebox'
import Fastify, { type FastifyBaseLogger } from 'fastify'

import { registerErrorHandler } from '@/shared/http/error-handler/index.js'
import { UuidGenerator } from '@/shared/id/uuid-generator/index.js'

export interface BuildAppDeps {
  readonly logger: FastifyBaseLogger
}

export function buildApp(deps: BuildAppDeps) {
  const requestIdGenerator = new UuidGenerator()

  const app = Fastify({
    loggerInstance: deps.logger,
    genReqId: () => requestIdGenerator.generate(),
  }).withTypeProvider<TypeBoxTypeProvider>()

  app.setValidatorCompiler(TypeBoxValidatorCompiler)

  void app.register(fastifySwagger, {
    openapi: { openapi: '3.1.0', info: { title: 'mindness', version: '1.0.0' } },
  })

  registerErrorHandler(app)

  return app
}
