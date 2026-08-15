import type { EventBus, IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

type EventHandler = (event: IntegrationEvent) => Promise<void>

export class FakeEventBus implements EventBus {
  readonly published: IntegrationEvent[] = []
  private readonly handlersByEventName = new Map<string, EventHandler[]>()

  subscribe(eventName: string, handler: EventHandler): void {
    const handlers = this.handlersByEventName.get(eventName) ?? []
    handlers.push(handler)
    this.handlersByEventName.set(eventName, handlers)
  }

  publish(event: IntegrationEvent): Promise<void> {
    this.published.push(event)
    return Promise.resolve()
  }
}
