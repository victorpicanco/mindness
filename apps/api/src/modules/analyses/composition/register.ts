import type { FastifyInstance } from 'fastify'

import { registerAnalysesErrorHandler } from '@/modules/analyses/presentation/error-handler/index.js'
import { registerAnalysesRoutes } from '@/modules/analyses/presentation/routes/analyses-routes/index.js'

import { createAnalysesContainer, type AnalysesModuleDeps } from './container.js'

export async function registerAnalysesModule(
  app: FastifyInstance,
  deps: AnalysesModuleDeps,
): Promise<ReturnType<typeof createAnalysesContainer>> {
  const container = createAnalysesContainer(deps)
  const subscriber = deps.eventSubscriber
  if (subscriber !== undefined) {
    subscriber.subscribe('recording_submitted', (event) =>
      container.eventHandlers.onRecordingSubmitted.handle(event),
    )
  }

  await app.register(async (scope) => {
    registerAnalysesErrorHandler(scope)
    await registerAnalysesRoutes(scope, {
      controllers: container.controllers,
      resolveAccountIdentity: container.useCases.resolveAccountIdentity,
    })
  })

  return container
}
