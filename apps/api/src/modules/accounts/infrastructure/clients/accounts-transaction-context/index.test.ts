import { describe, expect, it } from 'vitest'

import type { AccountsPrismaClient } from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'

import { AccountsTransactionContext } from './index.js'

function fakeClient(id: string): AccountsPrismaClient {
  return {
    account: {
      count: () => Promise.resolve(0),
      findUnique: () => Promise.resolve(null),
      upsert: (args) => Promise.resolve({ ...args.create, authUserId: id }),
    },
    accountDeletionRequest: {
      upsert: (args) => Promise.resolve(args.create),
    },
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

describe('AccountsTransactionContext', () => {
  it('has no active client outside a transaction', () => {
    expect(new AccountsTransactionContext().current()).toBeUndefined()
  })

  it('exposes the active client to the running operation only', async () => {
    const context = new AccountsTransactionContext()
    const client = fakeClient('transaction')

    const seen = await context.run(client, async () => {
      await delay(1)
      return context.current()
    })

    expect(seen).toBe(client)
    expect(context.current()).toBeUndefined()
  })

  it('keeps concurrent operations isolated from each other', async () => {
    const context = new AccountsTransactionContext()
    const first = fakeClient('first')
    const second = fakeClient('second')

    const [seenByFirst, seenBySecond] = await Promise.all([
      context.run(first, async () => {
        await delay(5)
        return context.current()
      }),
      context.run(second, async () => {
        await delay(1)
        return context.current()
      }),
    ])

    expect(seenByFirst).toBe(first)
    expect(seenBySecond).toBe(second)
  })
})
