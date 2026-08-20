import { AsyncLocalStorage } from 'node:async_hooks'

import type { SessionsPrismaClient } from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'

export class SessionsTransactionContext {
  private readonly storage = new AsyncLocalStorage<SessionsPrismaClient>()

  run<T>(client: SessionsPrismaClient, operation: () => Promise<T>): Promise<T> {
    return this.storage.run(client, operation)
  }

  current(): SessionsPrismaClient | undefined {
    return this.storage.getStore()
  }
}
