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
  const failedHandler = new OnAnalysisFailedFailSession(container.repositories.sessions)
  const timedOutHandler = new OnAnalysisTimedOutFailSession(container.repositories.sessions)
  const reject = (event: IntegrationEvent): void => {
    app.log.warn(
      { eventId: event.eventId, eventName: event.eventName },
      'analysis_event_payload_rejected',
    )
  }

  deps.eventSubscriber.subscribe('analysis_completed', async (event) => {
    const completed = parseAnalysisCompleted(event)
    if (completed === null) return reject(event)

    await completedHandler.handle(completed)
  })
  deps.eventSubscriber.subscribe('analysis_failed', async (event) => {
    const failed = parseSessionEvent(event, 'analysis_failed')
    if (failed === null) return reject(event)

    await failedHandler.handle(failed)
  })
  deps.eventSubscriber.subscribe('analysis_timeout', async (event) => {
    const timedOut = parseSessionEvent(event, 'analysis_timeout')
    if (timedOut === null) return reject(event)

    await timedOutHandler.handle(timedOut)
  })

  await app.register(async (scope) => {
    registerSessionsErrorHandler(scope)
    await registerSessionsRoutes(scope, {
      controllers: container.controllers,
      resolveAccountIdentity: container.useCases.resolveAccountIdentity,
    })
  })

  return container
}

function readSessionId(event: IntegrationEvent, eventName: string): string | null {
  if (event.eventName !== eventName) return null
  const payload: unknown = event.payload
  if (typeof payload !== 'object' || payload === null) return null
  if (!('sessionId' in payload) || typeof payload.sessionId !== 'string') return null

  return payload.sessionId
}

function parseSessionEvent(
  event: IntegrationEvent,
  eventName: 'analysis_failed',
): AnalysisFailedEvent | null
function parseSessionEvent(
  event: IntegrationEvent,
  eventName: 'analysis_timeout',
): AnalysisTimedOutEvent | null
function parseSessionEvent(
  event: IntegrationEvent,
  eventName: 'analysis_failed' | 'analysis_timeout',
): AnalysisFailedEvent | AnalysisTimedOutEvent | null {
  const sessionId = readSessionId(event, eventName)
  if (sessionId === null) return null

  return {
    eventId: event.eventId,
    eventName,
    occurredAt: event.occurredAt,
    version: event.version,
    payload: { sessionId },
  }
}

function parseAnalysisCompleted(event: IntegrationEvent): AnalysisCompletedEvent | null {
  const sessionId = readSessionId(event, 'analysis_completed')
  if (sessionId === null) return null

  const payload: unknown = event.payload
  if (typeof payload !== 'object' || payload === null) return null
  if (!('scores' in payload)) return null
  const scores: unknown = payload.scores
  if (typeof scores !== 'object' || scores === null) return null
  if (!('total' in scores) || typeof scores.total !== 'number') return null

  return {
    eventId: event.eventId,
    eventName: 'analysis_completed',
    occurredAt: event.occurredAt,
    version: event.version,
    payload: { sessionId, scores: { total: scores.total } },
  }
}
