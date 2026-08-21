import type { FastifyInstance } from 'fastify'

import { OnAnalysisCompletedCompleteSession } from '@/modules/sessions/application/event-handlers/on-analysis-completed-complete-session/index.js'
import type { AnalysisCompletedEvent } from '@/modules/sessions/application/event-handlers/on-analysis-completed-complete-session/index.js'
import { OnAnalysisFailedFailSession } from '@/modules/sessions/application/event-handlers/on-analysis-failed-fail-session/index.js'
import type { AnalysisFailedEvent } from '@/modules/sessions/application/event-handlers/on-analysis-failed-fail-session/index.js'
import { OnAnalysisTimedOutFailSession } from '@/modules/sessions/application/event-handlers/on-analysis-timed-out-fail-session/index.js'
import type { AnalysisTimedOutEvent } from '@/modules/sessions/application/event-handlers/on-analysis-timed-out-fail-session/index.js'
import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

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

  const completedHandler = new OnAnalysisCompletedCompleteSession(container.repositories.sessions)
  const failedHandler = new OnAnalysisFailedFailSession(
    container.repositories.sessions,
    container.ports.quota,
  )
  const timedOutHandler = new OnAnalysisTimedOutFailSession(
    container.repositories.sessions,
    container.ports.quota,
  )
  const subscriber = deps.eventSubscriber
  if (subscriber !== undefined) {
    subscriber.subscribe('analysis_completed', async (event) => {
      if (isAnalysisCompleted(event)) await completedHandler.handle(event)
    })
    subscriber.subscribe('analysis_failed', async (event) => {
      if (isAnalysisFailed(event)) await failedHandler.handle(event)
    })
    subscriber.subscribe('analysis_timeout', async (event) => {
      if (isAnalysisTimedOut(event)) await timedOutHandler.handle(event)
    })
  }

  await app.register(async (scope) => {
    registerSessionsErrorHandler(scope)
    await registerSessionsRoutes(scope, {
      controllers: container.controllers,
      resolveAccountIdentity: container.useCases.resolveAccountIdentity,
    })
  })

  return container
}

function isAnalysisCompleted(event: IntegrationEvent): event is AnalysisCompletedEvent {
  return event.eventName === 'analysis_completed'
}

function isAnalysisFailed(event: IntegrationEvent): event is AnalysisFailedEvent {
  return event.eventName === 'analysis_failed'
}

function isAnalysisTimedOut(event: IntegrationEvent): event is AnalysisTimedOutEvent {
  return event.eventName === 'analysis_timeout'
}
