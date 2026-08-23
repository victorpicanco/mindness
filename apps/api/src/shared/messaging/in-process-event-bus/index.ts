import type { Logger } from 'pino'

import { EventHandlerFailedError } from '@/shared/errors/event-handler-failed-error/index.js'
import type { EventBus, IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

type EventHandler = (event: IntegrationEvent) => Promise<void>

export class InProcessEventBus implements EventBus {
  private readonly handlersByEventName = new Map<string, EventHandler[]>()

  constructor(private readonly logger: Logger) {}

  subscribe(eventName: string, handler: EventHandler): void {
    const handlers = this.handlersByEventName.get(eventName) ?? []
    handlers.push(handler)
    this.handlersByEventName.set(eventName, handlers)
  }

  async publish(event: IntegrationEvent): Promise<void> {
    const handlers = this.handlersByEventName.get(event.eventName) ?? []

    const outcomes = await Promise.allSettled(handlers.map((handler) => handler(event)))
    const failures = outcomes.filter((outcome) => outcome.status === 'rejected')
    if (failures.length === 0) return

    for (const failure of failures) {
      this.logger.error(
        { err: failure.reason, eventId: event.eventId, eventName: event.eventName },
        'event handler failed',
      )
    }

    throw new EventHandlerFailedError({
      context: {
        eventName: event.eventName,
        eventId: event.eventId,
        failedHandlers: failures.length,
      },
      cause: failures[0]?.reason,
    })
  }
}
