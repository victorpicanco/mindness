import type { IntegrationEvent } from '@/shared/messaging/integration-event/index.js'

export interface EventPublisher {
  publish(event: IntegrationEvent): Promise<void>
}
