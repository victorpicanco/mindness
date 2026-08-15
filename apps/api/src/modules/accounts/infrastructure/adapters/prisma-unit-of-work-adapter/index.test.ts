import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import type {
  AccountsPrismaClient,
  AccountsPrismaTransactionRunner,
  TransactionOptions,
} from '@/modules/accounts/infrastructure/clients/accounts-prisma-client/index.js'
import { AccountsTransactionContext } from '@/modules/accounts/infrastructure/clients/accounts-transaction-context/index.js'
import { DatabaseError } from '@/shared/errors/database-error/index.js'

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

function translatedWriteConflict(): DatabaseError {
  return new DatabaseError('Failed to save the account', { cause: writeConflict() })
}

function createDelayRecorder(): {
  readonly waits: number[]
  delay: (attempt: number) => Promise<void>
} {
  const waits: number[] = []

  return {
    waits,
    delay: (attempt) => {
      waits.push(attempt)
      return Promise.resolve()
    },
  }
}

function createUnitOfWork(
  fake: FakeRunner,
  options: {
    context?: AccountsTransactionContext
    maxAttempts?: number
    retryDelay?: (attempt: number) => Promise<void>
  } = {},
): PrismaUnitOfWorkAdapter {
  return new PrismaUnitOfWorkAdapter(
    fake.runner,
    options.context ?? new AccountsTransactionContext(),
    {
      maxAttempts: options.maxAttempts ?? 3,
      retryDelay: options.retryDelay ?? (() => Promise.resolve()),
    },
  )
}

describe('PrismaUnitOfWorkAdapter', () => {
  it('runs the operation inside a serializable transaction', async () => {
    const fake = createRunner()

    await expect(createUnitOfWork(fake).run(() => Promise.resolve('done'))).resolves.toBe('done')
    expect(fake.attempts).toEqual([{ isolationLevel: 'Serializable' }])
  })

  it('exposes the transaction client to the operation and clears it afterwards', async () => {
    const fake = createRunner()
    const context = new AccountsTransactionContext()
    const unitOfWork = createUnitOfWork(fake, { context })

    const seen = await unitOfWork.run(() => Promise.resolve(context.current()))

    expect(seen).toBe(fake.client)
    expect(context.current()).toBeUndefined()
  })

  it('retries the transaction when the database reports a write conflict', async () => {
    const fake = createRunner([writeConflict()])

    await expect(createUnitOfWork(fake).run(() => Promise.resolve('done'))).resolves.toBe('done')
    expect(fake.attempts).toHaveLength(2)
  })

  it('retries when the write conflict arrives translated by the repository', async () => {
    const fake = createRunner([translatedWriteConflict()])

    await expect(createUnitOfWork(fake).run(() => Promise.resolve('done'))).resolves.toBe('done')
    expect(fake.attempts).toHaveLength(2)
  })

  it('waits between attempts, backing off per attempt', async () => {
    const recorder = createDelayRecorder()
    const fake = createRunner([writeConflict(), writeConflict()])

    await createUnitOfWork(fake, { retryDelay: recorder.delay }).run(() => Promise.resolve('done'))

    expect(recorder.waits).toEqual([0, 1])
  })

  it('gives up after the configured number of attempts', async () => {
    const lastConflict = writeConflict()
    const fake = createRunner([writeConflict(), writeConflict(), lastConflict])

    await expect(createUnitOfWork(fake).run(() => Promise.resolve('done'))).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      httpStatus: 500,
      context: { attempts: 3 },
      cause: lastConflict,
    })
    expect(fake.attempts).toHaveLength(3)
  })

  it('does not wait after the last attempt', async () => {
    const recorder = createDelayRecorder()
    const fake = createRunner([writeConflict(), writeConflict(), writeConflict()])

    await expect(
      createUnitOfWork(fake, { retryDelay: recorder.delay }).run(() => Promise.resolve('done')),
    ).rejects.toBeInstanceOf(DatabaseError)
    expect(recorder.waits).toEqual([0, 1])
  })

  it('runs at least once when configured with a nonsensical attempt count', async () => {
    const fake = createRunner()

    await expect(
      createUnitOfWork(fake, { maxAttempts: 0 }).run(() => Promise.resolve('done')),
    ).resolves.toBe('done')
    expect(fake.attempts).toHaveLength(1)
  })

  it('does not retry failures that are not write conflicts', async () => {
    const failure = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
      code: 'P2002',
      clientVersion: '7.9.1',
    })
    const fake = createRunner([failure])

    await expect(createUnitOfWork(fake).run(() => Promise.resolve('done'))).rejects.toBe(failure)
    expect(fake.attempts).toHaveLength(1)
  })
})
