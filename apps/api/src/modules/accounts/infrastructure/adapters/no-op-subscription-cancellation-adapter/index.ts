import type { SubscriptionCancellation } from '@/modules/accounts/domain/ports/subscription-cancellation/index.js'

export class NoOpSubscriptionCancellationAdapter implements SubscriptionCancellation {
  cancelActiveSubscription(): Promise<void> {
    return Promise.resolve()
  }
}
