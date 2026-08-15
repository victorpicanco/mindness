export interface IntegrationEvent<TName extends string = string, TPayload = unknown> {
  readonly eventId: string
  readonly eventName: TName
  readonly occurredAt: Date
  readonly version: number
  readonly payload: TPayload
}

export interface EventBus {
  publish(event: IntegrationEvent): Promise<void>
  subscribe(eventName: string, handler: (event: IntegrationEvent) => Promise<void>): void
}
