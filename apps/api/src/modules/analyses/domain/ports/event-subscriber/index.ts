import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

export interface EventSubscriber {
  subscribe(eventName: string, handler: (event: IntegrationEvent) => Promise<void>): void
}
