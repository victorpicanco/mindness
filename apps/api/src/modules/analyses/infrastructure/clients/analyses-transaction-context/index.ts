import { AsyncLocalStorage } from 'node:async_hooks'

import type { AnalysesPrismaClient } from '@/modules/analyses/infrastructure/clients/analyses-prisma-client/index.js'

export class AnalysesTransactionContext {
  private readonly storage = new AsyncLocalStorage<AnalysesPrismaClient>()

  run<T>(client: AnalysesPrismaClient, operation: () => Promise<T>): Promise<T> {
    return this.storage.run(client, operation)
  }

  current(): AnalysesPrismaClient | undefined {
    return this.storage.getStore()
  }
}
