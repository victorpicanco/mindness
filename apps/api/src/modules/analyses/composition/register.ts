import type { FastifyInstance } from 'fastify'

import { createAnalysesContainer, type AnalysesModuleDeps } from './container.js'

export function registerAnalysesModule(
  _app: FastifyInstance | undefined,
  deps: AnalysesModuleDeps,
) {
  const container = createAnalysesContainer(deps)
  const subscriber = deps.eventSubscriber
  if (subscriber !== undefined) {
    subscriber.subscribe('recording_submitted', (event) =>
      container.eventHandlers.onRecordingSubmitted.handle(event),
    )
  }
  return container
}
