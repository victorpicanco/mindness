export interface SubscriptionCancellation {
  cancelActiveSubscription(accountId: string): Promise<void>
}
