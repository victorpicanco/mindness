export interface AccountEvent {
  readonly eventName: string
  readonly accountId: string
  readonly plan: 'free'
  readonly occurredAt: Date
}

export interface EventPublisher {
  publish(event: AccountEvent): Promise<void>
}
