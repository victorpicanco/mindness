import { AsyncLocalStorage } from 'node:async_hooks'

export class TransactionContext<TClient> {
  private readonly storage = new AsyncLocalStorage<TClient>()

  run<T>(client: TClient, operation: () => Promise<T>): Promise<T> {
    return this.storage.run(client, operation)
  }

  current(): TClient | undefined {
    return this.storage.getStore()
  }
}
