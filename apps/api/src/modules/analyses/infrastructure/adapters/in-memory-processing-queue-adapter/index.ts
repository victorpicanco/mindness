import type { ProcessingQueuePort } from '@/modules/analyses/domain/ports/processing-queue-port/index.js'
import type { BaseError } from '@/shared/errors/base-error/index.js'

export class InMemoryProcessingQueueAdapter implements ProcessingQueuePort {
  private failure: BaseError | null = null
  readonly enqueued: { readonly sessionId: string }[] = []

  enqueue(input: { readonly sessionId: string }): Promise<void> {
    if (this.failure !== null) {
      const failure = this.failure
      this.failure = null
      return Promise.reject(failure)
    }
    this.enqueued.push(input)
    return Promise.resolve()
  }

  failNext(error: BaseError): void {
    this.failure = error
  }
}
