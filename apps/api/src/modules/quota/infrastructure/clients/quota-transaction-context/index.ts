import { AsyncLocalStorage } from 'node:async_hooks'

import type { QuotaPrismaClient } from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'

export class QuotaTransactionContext {
  private readonly storage = new AsyncLocalStorage<QuotaPrismaClient>()

  run<T>(client: QuotaPrismaClient, operation: () => Promise<T>): Promise<T> {
    return this.storage.run(client, operation)
  }

  current(): QuotaPrismaClient | undefined {
    return this.storage.getStore()
  }
}
