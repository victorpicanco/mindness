import type { Logger } from 'pino'

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

    await Promise.all(
      handlers.map(async (handler) => {
        try {
          await handler(event)
        } catch (error) {
          this.logger.error(
            { err: error, eventId: event.eventId, eventName: event.eventName },
            'event handler failed',
          )
        }
      }),
    )
  }
}
