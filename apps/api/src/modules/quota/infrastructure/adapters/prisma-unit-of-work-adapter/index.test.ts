import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { QuotaCycleAlreadyOpenError } from '@/modules/quota/domain/errors/quota-cycle-already-open-error/index.js'
import type {
  QuotaPrismaClient,
  QuotaPrismaTransactionRunner,
  TransactionOptions,
} from '@/modules/quota/infrastructure/clients/quota-prisma-client/index.js'
import { QuotaTransactionContext } from '@/modules/quota/infrastructure/clients/quota-transaction-context/index.js'
import type { DatabaseError } from '@/shared/errors/database-error/index.js'
import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

import { PrismaUnitOfWorkAdapter } from './index.js'

interface FakeRunner {
  readonly attempts: TransactionOptions[]
  readonly client: QuotaPrismaClient
  readonly runner: QuotaPrismaTransactionRunner
}

function createRunner(failures: Error[] = []): FakeRunner {
  const attempts: TransactionOptions[] = []
  const pending = [...failures]
  const client: QuotaPrismaClient = {
    quotaCycle: {
      findFirst: () => Promise.resolve(null),
      create: (args) => Promise.resolve(args.data),
    },
    quotaReservation: {
      count: () => Promise.resolve(0),
      findUnique: () => Promise.resolve(null),
      upsert: (args) => Promise.resolve(args.create),
    },
  }

  return {
    attempts,
    client,
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

function prismaWriteConflict(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Write conflict', {
    code: 'P2034',
    clientVersion: '7.9.1',
  })
}

class FakeDriverAdapterError extends Error {
  override readonly name = 'DriverAdapterError'

  constructor() {
    super('TransactionWriteConflict', { cause: { kind: 'TransactionWriteConflict' } })
  }
}

function driverAdapterWriteConflict(): Error {
  return new FakeDriverAdapterError()
}

function createUnitOfWork(
  fake: FakeRunner,
  options: {
    maxAttempts?: number
    retryDelay?: (attempt: number) => Promise<void>
  } = {},
): PrismaUnitOfWorkAdapter {
  const retryDelay = options.retryDelay ?? (() => Promise.resolve())
  const adapterOptions =
    options.maxAttempts === undefined
      ? { retryDelay }
      : { maxAttempts: options.maxAttempts, retryDelay }

  return new PrismaUnitOfWorkAdapter(fake.runner, new QuotaTransactionContext(), adapterOptions)
}

describe('PrismaUnitOfWorkAdapter', () => {
  it.each([
    ['the Prisma serialization failure', prismaWriteConflict()],
    ['the pg driver serialization failure', driverAdapterWriteConflict()],
    ['a concurrent cycle opening', new QuotaCycleAlreadyOpenError('account-id', new Date())],
  ])('retries %s', async (_description, conflict) => {
    const fake = createRunner([conflict])

    await expect(createUnitOfWork(fake).run(() => Promise.resolve('done'))).resolves.toBe('done')
    expect(fake.attempts).toHaveLength(2)
    expect(fake.attempts).toEqual([
      { isolationLevel: 'Serializable' },
      { isolationLevel: 'Serializable' },
    ])
  })

  it('does not retry an unrelated failure', async () => {
    const failure = new OperationFailedError('Unexpected failure')
    const fake = createRunner([failure])

    await expect(createUnitOfWork(fake).run(() => Promise.resolve('done'))).rejects.toBe(failure)
    expect(fake.attempts).toHaveLength(1)
  })

  it('stops at maxAttempts and preserves the last conflict as the database error cause', async () => {
    const lastConflict = new QuotaCycleAlreadyOpenError('account-id', new Date())
    const fake = createRunner([
      prismaWriteConflict(),
      driverAdapterWriteConflict(),
      prismaWriteConflict(),
      driverAdapterWriteConflict(),
      lastConflict,
    ])
    const delays: number[] = []

    await expect(
      createUnitOfWork(fake, {
        retryDelay: (attempt) => {
          delays.push(attempt)
          return Promise.resolve()
        },
      }).run(() => Promise.resolve('done')),
    ).rejects.toMatchObject({
      code: 'shared.DATABASE_ERROR',
      context: { attempts: 5 },
      cause: lastConflict,
    } satisfies Partial<DatabaseError>)
    expect(fake.attempts).toHaveLength(5)
    expect(delays).toEqual([0, 1, 2, 3])
  })
})
