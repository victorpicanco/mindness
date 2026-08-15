import type { SubscriptionCancellation } from '@/modules/accounts/domain/ports/subscription-cancellation/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

export class InMemorySubscriptionCancellationAdapter implements SubscriptionCancellation {
  readonly canceled: string[] = []
  private failure: BaseError | null = null

  cancelActiveSubscription(accountId: string): Promise<void> {
    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      return Promise.reject(failure)
    }

    this.canceled.push(accountId)
    return Promise.resolve()
  }

  simulateFailure(error: BaseError): void {
    this.failure = error
  }

  reset(): void {
    this.canceled.length = 0
    this.failure = null
  }
}
