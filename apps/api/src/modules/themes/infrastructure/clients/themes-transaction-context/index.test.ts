import { describe, expect, it } from 'vitest'

import type { ThemesPrismaClient } from '@/modules/themes/infrastructure/clients/themes-prisma-client/index.js'

import { ThemesTransactionContext } from './index.js'

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
    $executeRaw: () => Promise.resolve(0),
  }
}

describe('ThemesTransactionContext', () => {
  it('exposes no client outside of a transaction', () => {
    expect(new ThemesTransactionContext().current()).toBeUndefined()
  })

  it('exposes the transaction client to everything the operation awaits', async () => {
    const context = new ThemesTransactionContext()
    const client = fakeClient()

    const seen = await context.run(client, async () => {
      await Promise.resolve()
      return context.current()
    })

    expect(seen).toBe(client)
  })

  it('restores the previous absence of a client once the operation settles', async () => {
    const context = new ThemesTransactionContext()

    await expect(
      context.run(fakeClient(), () => Promise.reject(new RangeError('rolled back'))),
    ).rejects.toBeInstanceOf(RangeError)

    expect(context.current()).toBeUndefined()
  })

  it('keeps concurrent operations isolated from each other', async () => {
    const context = new ThemesTransactionContext()
    const first = fakeClient()
    const second = fakeClient()

    const [seenByFirst, seenBySecond] = await Promise.all([
      context.run(first, async () => {
        await Promise.resolve()
        return context.current()
      }),
      context.run(second, () => Promise.resolve(context.current())),
    ])

    expect(seenByFirst).toBe(first)
    expect(seenBySecond).toBe(second)
  })
})
