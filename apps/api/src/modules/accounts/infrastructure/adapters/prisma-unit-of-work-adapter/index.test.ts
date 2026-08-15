import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { TransactionContext } from '@/shared/database/transaction-context/index.js'

import type {
  AccountsPrismaClient,
  AccountsPrismaTransactionRunner,
  TransactionOptions,
} from '../../clients/accounts-prisma-client/index.js'
import { PrismaUnitOfWorkAdapter } from './index.js'

interface FakeRunner {
  readonly runner: AccountsPrismaTransactionRunner
  readonly client: AccountsPrismaClient
  readonly attempts: TransactionOptions[]
}

function createRunner(failures: Error[] = []): FakeRunner {
  const attempts: TransactionOptions[] = []
  const pending = [...failures]
  const client: AccountsPrismaClient = {
    account: {
      findUnique: () => Promise.resolve(null),
      upsert: (args) => Promise.resolve(args.create),
    },
  }

  return {
    client,
    attempts,
    runner: {
      $transaction: (operation, options) => {
        attempts.push(options)
        const failure = pending.shift()
        if (failure !== undefined) return Promise.reject(failure)
        return operation(client)
      },
    },
  }
}

function writeConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Write conflict', {
    code: 'P2034',
    clientVersion: '7.9.1',
  })
}

describe('PrismaUnitOfWorkAdapter', () => {
  it('runs the operation inside a serializable transaction', async () => {
    const fake = createRunner()
    const unitOfWork = new PrismaUnitOfWorkAdapter(
      fake.runner,
      new TransactionContext<AccountsPrismaClient>(),
      3,
    )

    await expect(unitOfWork.run(() => Promise.resolve('done'))).resolves.toBe('done')
    expect(fake.attempts).toEqual([{ isolationLevel: 'Serializable' }])
  })

  it('exposes the transaction client to the operation and clears it afterwards', async () => {
    const fake = createRunner()
    const context = new TransactionContext<AccountsPrismaClient>()
    const unitOfWork = new PrismaUnitOfWorkAdapter(fake.runner, context, 3)

    const seen = await unitOfWork.run(() => Promise.resolve(context.current()))

    expect(seen).toBe(fake.client)
    expect(context.current()).toBeUndefined()
  })

  it('retries the transaction when the database reports a write conflict', async () => {
    const fake = createRunner([writeConflict()])
    const unitOfWork = new PrismaUnitOfWorkAdapter(
      fake.runner,
      new TransactionContext<AccountsPrismaClient>(),
      3,
    )

    await expect(unitOfWork.run(() => Promise.resolve('done'))).resolves.toBe('done')
    expect(fake.attempts).toHaveLength(2)
  })

  it('gives up after the configured number of attempts', async () => {
    const lastConflict = writeConflict()
    const fake = createRunner([writeConflict(), writeConflict(), lastConflict])
    const unitOfWork = new PrismaUnitOfWorkAdapter(
      fake.runner,
      new TransactionContext<AccountsPrismaClient>(),
      3,
    )

    await expect(unitOfWork.run(() => Promise.resolve('done'))).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      httpStatus: 500,
      context: { attempts: 3 },
      cause: lastConflict,
    })
    expect(fake.attempts).toHaveLength(3)
  })

  it('does not retry failures that are not write conflicts', async () => {
    const failure = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.9.1',
    })
    const fake = createRunner([failure])
    const unitOfWork = new PrismaUnitOfWorkAdapter(
      fake.runner,
      new TransactionContext<AccountsPrismaClient>(),
      3,
    )

    await expect(unitOfWork.run(() => Promise.resolve('done'))).rejects.toBe(failure)
    expect(fake.attempts).toHaveLength(1)
  })
})
