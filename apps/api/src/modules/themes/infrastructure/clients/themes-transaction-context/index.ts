import { AsyncLocalStorage } from 'node:async_hooks'

import type { ThemesPrismaClient } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'

export class ThemesTransactionContext {
  private readonly storage = new AsyncLocalStorage<ThemesPrismaClient>()

  run<T>(client: ThemesPrismaClient, operation: () => Promise<T>): Promise<T> {
    return this.storage.run(client, operation)
  }

  current(): ThemesPrismaClient | undefined {
    return this.storage.getStore()
  }
}
