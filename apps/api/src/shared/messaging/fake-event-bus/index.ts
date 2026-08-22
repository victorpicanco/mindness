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

  async deliver(event: IntegrationEvent): Promise<void> {
    const handlers = this.handlersByEventName.get(event.eventName) ?? []
    await Promise.all(handlers.map((handler) => handler(event)))
  }

  publish(event: IntegrationEvent): Promise<void> {
    this.published.push(event)
    return Promise.resolve()
  }
}
