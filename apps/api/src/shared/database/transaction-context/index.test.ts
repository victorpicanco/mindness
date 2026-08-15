import { describe, expect, it } from 'vitest'

import { TransactionContext } from './index.js'

interface FakeClient {
  readonly name: string
}

function delay(milliseconds: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds))
}

describe('TransactionContext', () => {
  it('has no active client outside a transaction', () => {
    const context = new TransactionContext<FakeClient>()

    expect(context.current()).toBeUndefined()
  })

  it('exposes the active client to the running operation only', async () => {
    const context = new TransactionContext<FakeClient>()
    const client: FakeClient = { name: 'transaction' }

    const seen = await context.run(client, async () => {
      await delay(1)
      return context.current()
    })

    expect(seen).toBe(client)
    expect(context.current()).toBeUndefined()
  })

  it('keeps concurrent operations isolated from each other', async () => {
    const context = new TransactionContext<FakeClient>()
    const first: FakeClient = { name: 'first' }
    const second: FakeClient = { name: 'second' }

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
