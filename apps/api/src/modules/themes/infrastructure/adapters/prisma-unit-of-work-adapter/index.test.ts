import { describe, expect, it } from 'vitest'

import type {
  ThemesPrismaClient,
  ThemesPrismaTransactionRunner,
  ThemesTransactionOptions,
} from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'
import { ThemesTransactionContext } from '@/modules/themes/infrastructure/clients/themes-transaction-context/index.js'

import { PrismaUnitOfWorkAdapter, THEME_CATALOG_SYNC_TRANSACTION_TIMEOUT_MS } from './index.js'

function fakeClient(): ThemesPrismaClient {
  return {
    theme: {
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve(null),
      upsert: (args) => Promise.resolve(args.create),
      count: () => Promise.resolve(0),
      findMany: () => Promise.resolve([]),
    },
    themeCategory: {
      findUnique: () => Promise.resolve(null),
      upsert: (args) => Promise.resolve(args.create),
      findMany: () => Promise.resolve([]),
    },
    $queryRaw: () => Promise.resolve([]),
  }
}

interface FakeRunner extends ThemesPrismaTransactionRunner {
  readonly options: ThemesTransactionOptions[]
  readonly transactionClient: ThemesPrismaClient
}

function createRunner(): FakeRunner {
  const options: ThemesTransactionOptions[] = []
  const transactionClient = fakeClient()

  return {
    options,
    transactionClient,
    $transaction: (operation, transactionOptions) => {
      options.push(transactionOptions)
      return operation(transactionClient)
    },
  }
}

describe('PrismaUnitOfWorkAdapter', () => {
  it('runs the operation inside a serializable transaction', async () => {
    const runner = createRunner()
    const adapter = new PrismaUnitOfWorkAdapter(runner, new ThemesTransactionContext())

    await expect(adapter.run(() => Promise.resolve('done'))).resolves.toBe('done')
    expect(runner.options).toStrictEqual([
      { isolationLevel: 'Serializable', timeout: THEME_CATALOG_SYNC_TRANSACTION_TIMEOUT_MS },
    ])
  })

  it('binds the transaction client to the context for the whole operation', async () => {
    const runner = createRunner()
    const context = new ThemesTransactionContext()
    const adapter = new PrismaUnitOfWorkAdapter(runner, context)

    const seen = await adapter.run(async () => {
      await Promise.resolve()
      return context.current()
    })

    expect(seen).toBe(runner.transactionClient)
    expect(context.current()).toBeUndefined()
  })

  it('lets a failure escape so the transaction rolls back', async () => {
    const runner = createRunner()
    const context = new ThemesTransactionContext()
    const adapter = new PrismaUnitOfWorkAdapter(runner, context)

    await expect(adapter.run(() => Promise.reject(new RangeError('boom')))).rejects.toBeInstanceOf(
      RangeError,
    )
    expect(context.current()).toBeUndefined()
  })
})
