import type { FastifyInstance } from 'fastify'

import { registerSessionsErrorHandler } from '@/modules/sessions/presentation/error-handler/index.js'
import { registerSessionsRoutes } from '@/modules/sessions/presentation/routes/sessions-routes/index.js'

import {
  createSessionsContainer,
  type SessionsContainer,
  type SessionsModuleDeps,
} from './container.js'

export async function registerSessionsModule(
  app: FastifyInstance,
  deps: SessionsModuleDeps,
): Promise<SessionsContainer> {
  const container = createSessionsContainer(deps)

  await app.register(async (scope) => {
    registerSessionsErrorHandler(scope)
    await registerSessionsRoutes(scope, {
      controllers: container.controllers,
      resolveAccountIdentity: container.useCases.resolveAccountIdentity,
    })
  })

  return container
}
