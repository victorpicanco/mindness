import { describe, expect, it } from 'vitest'

import { Prisma } from '@/generated/prisma/client.js'
import { TransactionContext } from '@/shared/database/transaction-context/index.js'

import { Account } from '../../../domain/entities/account/index.js'
import { AccountAlreadyExistsError } from '../../../domain/errors/account-already-exists-error/index.js'
import type {
  AccountRow,
  AccountsPrismaClient,
  AccountUpsertArgs,
} from '../../clients/accounts-prisma-client/index.js'
import { AccountMapper } from '../../mappers/account-mapper/index.js'
import { PrismaAccountsRepository } from './index.js'

const row: AccountRow = {
  id: '2f1a3c2e-7b64-4f4a-9a1e-6f6a2c9b7d10',
  email: 'person@example.com',
  authUserId: 'auth-user-1',
  timeZone: 'America/Sao_Paulo',
  plan: 'free',
  status: 'accessible',
  createdAt: new Date('2026-08-15T00:00:00.000Z'),
}

interface FakeClient {
  readonly client: AccountsPrismaClient
  readonly upserts: AccountUpsertArgs[]
}

function createFakeClient(options: { rows?: AccountRow[]; failure?: Error } = {}): FakeClient {
  const rows = options.rows ?? []
  const upserts: AccountUpsertArgs[] = []

  return {
    upserts,
    client: {
      account: {
        findUnique: ({ where }) =>
          Promise.resolve(rows.find((stored) => stored.authUserId === where.authUserId) ?? null),
        upsert: (args) => {
          if (options.failure !== undefined) return Promise.reject(options.failure)
          upserts.push(args)
          return Promise.resolve(args.create)
        },
      },
    },
  }
}

function uniqueViolation(fields: string[]): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '7.9.1',
    meta: {
      modelName: 'Account',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '23505',
          kind: 'UniqueConstraintViolation',
          constraint: { fields },
        },
      },
    },
  })
}

function createRepository(
  fake: FakeClient,
  context = new TransactionContext<AccountsPrismaClient>(),
): PrismaAccountsRepository {
  return new PrismaAccountsRepository(fake.client, context, new AccountMapper())
}

describe('PrismaAccountsRepository', () => {
  it('reconstitutes the aggregate persisted for an external identity', async () => {
    const repository = createRepository(createFakeClient({ rows: [row] }))

    const account = await repository.findByAuthUserId('auth-user-1')

    expect(account).toBeInstanceOf(Account)
    expect(account).toMatchObject({
      id: row.id,
      email: row.email,
      authUserId: row.authUserId,
      timeZone: row.timeZone,
      plan: 'free',
      status: 'accessible',
    })
  })

  it('returns null when no account belongs to the external identity', async () => {
    const repository = createRepository(createFakeClient({ rows: [row] }))

    await expect(repository.findByAuthUserId('auth-user-2')).resolves.toBeNull()
  })

  it('persists the whole aggregate under its own identifier', async () => {
    const fake = createFakeClient()
    const repository = createRepository(fake)

    await repository.save(
      Account.create({
        id: row.id,
        email: row.email,
        authUserId: row.authUserId,
        timeZone: row.timeZone,
        createdAt: row.createdAt,
      }),
    )

    expect(fake.upserts).toEqual([{ where: { id: row.id }, create: row, update: row }])
  })

  it('translates a unique violation into a conflict of the domain', async () => {
    const repository = createRepository(
      createFakeClient({ failure: uniqueViolation(['auth_user_id']) }),
    )

    await expect(
      repository.save(
        Account.create({
          id: row.id,
          email: row.email,
          authUserId: row.authUserId,
          timeZone: row.timeZone,
          createdAt: row.createdAt,
        }),
      ),
    ).rejects.toMatchObject({
      code: 'accounts.ACCOUNT_ALREADY_EXISTS',
      httpStatus: 409,
      context: { fields: ['auth_user_id'] },
    })
  })

  it('keeps write conflicts unchanged so the transaction can be retried', async () => {
    const conflict = new Prisma.PrismaClientKnownRequestError('Write conflict', {
      code: 'P2034',
      clientVersion: '7.9.1',
    })
    const repository = createRepository(createFakeClient({ failure: conflict }))

    await expect(
      repository.save(
        Account.create({
          id: row.id,
          email: row.email,
          authUserId: row.authUserId,
          timeZone: row.timeZone,
          createdAt: row.createdAt,
        }),
      ),
    ).rejects.toBe(conflict)
  })

  it('reads and writes through the client of the active transaction', async () => {
    const outside = createFakeClient()
    const inside = createFakeClient({ rows: [row] })
    const context = new TransactionContext<AccountsPrismaClient>()
    const repository = createRepository(outside, context)

    const account = await context.run(inside.client, async () => {
      const found = await repository.findByAuthUserId('auth-user-1')
      await repository.save(
        Account.create({
          id: row.id,
          email: row.email,
          authUserId: row.authUserId,
          timeZone: row.timeZone,
          createdAt: row.createdAt,
        }),
      )
      return found
    })

    expect(account).not.toBeNull()
    expect(inside.upserts).toHaveLength(1)
    expect(outside.upserts).toHaveLength(0)
  })
})

describe('AccountAlreadyExistsError', () => {
  it('never exposes the conflicting value', () => {
    const error = new AccountAlreadyExistsError(['email'])

    expect(error.message).not.toContain('@')
    expect(error.context).toEqual({ fields: ['email'] })
  })
})
