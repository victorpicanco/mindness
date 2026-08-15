import { AsyncLocalStorage } from 'node:async_hooks'

import type { AccountsPrismaClient } from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'

export class AccountsTransactionContext {
  private readonly storage = new AsyncLocalStorage<AccountsPrismaClient>()

  run<T>(client: AccountsPrismaClient, operation: () => Promise<T>): Promise<T> {
    return this.storage.run(client, operation)
  }

  current(): AccountsPrismaClient | undefined {
    return this.storage.getStore()
  }
}
