import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import type {
  SessionsPrismaClient,
  SessionsPrismaTransactionRunner,
  TransactionOptions,
} from '@/modules/sessions/infrastructure/clients/sessions-prisma-client/index.js'
import { SessionsTransactionContext } from '@/modules/sessions/infrastructure/clients/sessions-transaction-context/index.js'
import type { DatabaseError } from '@/shared/errors/database-error/index.js'
import { OperationFailedError } from '@/shared/errors/operation-failed-error/index.js'

import { PrismaUnitOfWorkAdapter } from './index.js'

interface FakeRunner {
  readonly attempts: TransactionOptions[]
  readonly runner: SessionsPrismaTransactionRunner
}

function createRunner(failures: Error[] = []): FakeRunner {
  const attempts: TransactionOptions[] = []
  const pending = [...failures]
  const client: SessionsPrismaClient = {
    session: {
      findUnique: () => Promise.resolve(null),
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
      upsert: () =>
        Promise.resolve({
          id: 'session-id',
          accountId: 'account-id',
          themeId: 'theme-id',
          difficulty: 'balanced',
          categorySlug: 'self-awareness',
          searchWindowMinutes: 4,
          quotaReservationId: 'reservation-id',
          state: 'in_progress',
          expiredReason: null,
          createdAt: new Date(),
          expiresAt: new Date(),
          expiredAt: null,
          recordedAt: null,
          audio: null,
        }),
    },
  }

  return {
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

  return new PrismaUnitOfWorkAdapter(fake.runner, new SessionsTransactionContext(), adapterOptions)
}

describe('PrismaUnitOfWorkAdapter', () => {
  it.each([
    ['the Prisma serialization failure', prismaWriteConflict()],
    ['the pg driver serialization failure', new FakeDriverAdapterError()],
  ])('retries %s', async (_description, conflict) => {
    const fake = createRunner([conflict])

    await expect(createUnitOfWork(fake).run(() => Promise.resolve('done'))).resolves.toBe('done')
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
    const lastConflict = prismaWriteConflict()
    const fake = createRunner([
      prismaWriteConflict(),
      new FakeDriverAdapterError(),
      prismaWriteConflict(),
      new FakeDriverAdapterError(),
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
